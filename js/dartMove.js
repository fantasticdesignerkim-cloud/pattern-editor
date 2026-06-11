// ══════════════════════════════════════════════
// 다트이동 — 실제 앞판 패턴선 기준 cutPoint 선택 + BP 절개선
// 기준: render.js가 그리는 앞판 최종 외곽선과 같은 계산 사용
// ══════════════════════════════════════════════

const dartMoveState = {
  active:        false,
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

// ── 앞판 외곽선을 G/GG 기준으로 두 조각 분할 ─
// fixedPts  = G를 포함하는 조각 (고정)
// rotatePts = GG를 포함하는 조각 (회전 대상)
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
    // cutSegIndex segment: seg.from → cutPoint (cutPoint 이전 부분만)
    // 이후 segments: from/to 뒤집어서 cutPoint→hit 방향으로 정렬
    const pts  = [{ ...cutPoint }];
    const segs = [];
    let hit = null;
    for (let step = 0; step < nn; step++) {
      const idx = (cutSegIndex - step + nn) % nn;
      const seg = segments[idx];
      const prev = { ...seg.from };
      if (seg.disabled && !isG(prev) && !isGG(prev)) continue;
      // cutSegIndex segment는 to를 cutPoint로 교체 (cutPoint 이후 구간 제거)
      // from/to 뒤집기: 역방향 이동이므로 실제 방향은 to→from
      const toPt   = (step === 0) ? { ...cutPoint } : { ...seg.from };
      const fromPt = (step === 0) ? { ...seg.from } : { ...seg.to  };
      segs.push({ from: fromPt, to: toPt, type: seg.type, disabled: !!seg.disabled });
      pts.push(prev);
      if (isG(prev))  { hit = "G";  break; }
      if (isGG(prev)) { hit = "GG"; break; }
    }
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

  if (forward.hit === "G" && backward.hit === "GG") {
    fixedPts  = forward.pts;  fixedSegs  = forward.segs;
    rotatePts = backward.pts; rotateSegs = backward.segs;
  } else if (forward.hit === "GG" && backward.hit === "G") {
    fixedPts  = backward.pts; fixedSegs  = backward.segs;
    rotatePts = forward.pts;  rotateSegs = forward.segs;
  } else {
    const fEnd = forward.pts[forward.pts.length - 1];
    const bEnd = backward.pts[backward.pts.length - 1];
    const fDistGG = Math.hypot(fEnd.x - GG.x, fEnd.y - GG.y);
    const bDistGG = Math.hypot(bEnd.x - GG.x, bEnd.y - GG.y);
    if (fDistGG < bDistGG) {
      rotatePts = forward.pts;  rotateSegs = forward.segs;
      fixedPts  = backward.pts; fixedSegs  = backward.segs;
    } else {
      rotatePts = backward.pts; rotateSegs = backward.segs;
      fixedPts  = forward.pts;  fixedSegs  = forward.segs;
    }
  }

  // BP·cutPoint로 닫아서 조각처럼 표시 (pts는 호환성 유지)
  const rotateClosed = [...rotatePts, { ...p.BP }, { ...cutPoint }];
  const fixedClosed  = [...fixedPts,  { ...p.BP }, { ...cutPoint }];

  return { fixedPts: fixedClosed, rotatePts: rotateClosed, fixedSegs, rotateSegs };
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
  setHint("앞판 외곽선을 클릭하세요");
  render();
}

function cancelDartMove() {
  dartMoveState.active        = false;
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
  render();
}

function resetDartMove() {
  dartMoveState.active        = false;
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

  const rotatedPts = dartMoveState.rotatePts.map(pt => rotatePt(pt, p.BP, angle));
  const cut2 = rotatePt(dartMoveState.cutPoint, p.BP, angle);

  // rotateSegs의 from/to를 BP 기준으로 회전
  const rotatedSegs = (dartMoveState.rotateSegs || []).map(seg => ({
    from:     rotatePt(seg.from, p.BP, angle),
    to:       rotatePt(seg.to,   p.BP, angle),
    type:     seg.type,
    disabled: seg.disabled,
  }));

  // G / rotatedGG 명시 추출 (render.js가 추측하지 않아도 되도록)
  const fixedSegsAll   = dartMoveState.fixedSegs  || [];
  const rotateSegsAll  = dartMoveState.rotateSegs || [];
  const GPoint         = fixedSegsAll.length  ? fixedSegsAll[fixedSegsAll.length - 1].to   : null;
  const GGPoint        = rotateSegsAll.length ? rotateSegsAll[rotateSegsAll.length - 1].to : null;
  const rotatedGGPoint = GGPoint ? rotatePt(GGPoint, p.BP, angle) : null;

  dartMoveState.applied = {
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
      const segsHov = buildFrontOutline(dHov.pts, dHov.formula, B);
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
  const [bx, by] = c2p(p.BP.x, p.BP.y);

  const dDraft = createDraft(B, W, BL);
  const segs   = buildFrontOutline(dDraft.pts, dDraft.formula, B);

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
  const rotated = rotatePts.map(pt => rotatePt(pt, p.BP, angle));
  if (rotated.length >= 2) {
    g.appendChild(E("polyline", {
      points: ptsToSvgPoints(rotated),
      fill: "none", stroke: "#44aaff",
      "stroke-width": 2, opacity: 0.8,
      "stroke-dasharray": "5,3",
    }));
  }

  // ── BP→cutPoint 절개선 (주황) ─────────────────
  g.appendChild(E("line", { x1: bx, y1: by, x2: cx, y2: cy, stroke: "#e07800", "stroke-width": 1.8, "stroke-dasharray": "6,3" }));

  // ── BP→cutPoint2 새 다트 다리 (파랑) ──────────
  const cut2 = rotatePt(cut, p.BP, angle);
  const [cx2, cy2] = c2p(cut2.x, cut2.y);
  g.appendChild(E("line", { x1: bx, y1: by, x2: cx2, y2: cy2, stroke: "#44aaff", "stroke-width": 1.8, "stroke-dasharray": "6,3" }));

  // ── cutPoint 원 (주황, 고정) ───────────────────
  g.appendChild(E("circle", { cx, cy, r: 7, fill: "#e07800", stroke: "#fff", "stroke-width": 2 }));

  // ── 각도 표시 ─────────────────────────────────
  const degVal = (angle * 180 / Math.PI).toFixed(1);
  const [lx, ly] = c2p(p.BP.x + 1.5, p.BP.y - 1.5);
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
    // 드래그 핸들 위 클릭은 cutPoint 선택 무시
    if (e.target.closest(".dart-rotate-handle")) return;

    const [cx, cy] = eventToPatternPoint(e);
    const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
    if (!B || !W || !BL) return;
    const d = createDraft(B, W, BL);
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

      // 조각 분할 + 기준 각도 계산
      const { closeAngle } = calcCloseAngle(d.pts, B);
      const { rotatePts, fixedPts, fixedSegs, rotateSegs } = splitFrontOutline(
        segments, result.point, result.segIndex, d.pts, B
      );
      dartMoveState.baseAngle  = closeAngle;
      dartMoveState.userAngle  = closeAngle;
      dartMoveState.rotatePts  = rotatePts;
      dartMoveState.fixedPts   = fixedPts;
      dartMoveState.fixedSegs  = fixedSegs;
      dartMoveState.rotateSegs = rotateSegs;
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
    if (dartMoveState.dragging) return;
    if (dartMoveState.cutPoint) return;
    if (e.target.closest(".dart-rotate-handle")) return;

    const [mx, my] = eventToPatternPoint(e);
    const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
    if (!B || !W || !BL) return;
    const dh = createDraft(B, W, BL);
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

    // 마우스 방향각 - cutPoint 방향각 = userAngle
    const angleMouse = Math.atan2(my - p.BP.y, mx - p.BP.x);
    const angleCut   = Math.atan2(dartMoveState.cutPoint.y - p.BP.y, dartMoveState.cutPoint.x - p.BP.x);
    let userAngle = angleMouse - angleCut;

    // -π ~ π 정규화
    while (userAngle >  Math.PI) userAngle -= 2 * Math.PI;
    while (userAngle < -Math.PI) userAngle += 2 * Math.PI;

    // 범위 제한: 0 ~ baseAngle (패턴 겹침 방지)
    const base = dartMoveState.baseAngle;
    // baseAngle은 음수 방향 — 범위: baseAngle ~ 0
    userAngle = Math.max(base, Math.min(0, userAngle));

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
