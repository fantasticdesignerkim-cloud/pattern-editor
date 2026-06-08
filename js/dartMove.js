// ══════════════════════════════════════════════
// 다트이동 — 실제 앞판 패턴선 기준 cutPoint 선택 + BP 절개선
// 기준: render.js가 그리는 앞판 최종 외곽선과 같은 계산 사용
// ══════════════════════════════════════════════

const dartMoveState = {
  active: false,
  cutPoint: null,
  cutSegIndex: -1,
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

// ── 앞판 외곽선을 두 조각으로 분할 ───────────
// 반환: { fixedPts, rotatePts }
// fixedPts  = front-center를 포함하는 조각 (CF쪽, 고정)
// rotatePts = 반대 조각 (회전 대상, cutPoint에서 시작)
// ── 앞판 외곽선을 G/GG 기준으로 두 조각 분할 ───────────
// fixedPts  = G를 포함하는 조각
// rotatePts = GG를 포함하는 조각
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
    const pts = [{ ...cutPoint }];
    let hit = null;
    for (let step = 0; step < nn; step++) {
      const idx = (cutSegIndex + step) % nn;
      const seg = segments[idx];
      const next = { ...seg.to };
      if (seg.disabled && !isG(next) && !isGG(next)) continue;
      pts.push(next);
      if (isG(next))  { hit = "G";  break; }
      if (isGG(next)) { hit = "GG"; break; }
    }
    return { pts, hit };
  }

  function walkBackward() {
    const pts = [{ ...cutPoint }];
    let hit = null;
    for (let step = 0; step < nn; step++) {
      const idx = (cutSegIndex - step + nn) % nn;
      const seg = segments[idx];
      const prev = { ...seg.from };
      if (seg.disabled && !isG(prev) && !isGG(prev)) continue;
      pts.push(prev);
      if (isG(prev))  { hit = "G";  break; }
      if (isGG(prev)) { hit = "GG"; break; }
    }
    return { pts, hit };
  }

  const forward  = walkForward();
  const backward = walkBackward();

  let fixedPts = [], rotatePts = [];

  if (forward.hit === "G" && backward.hit === "GG") {
    fixedPts  = forward.pts;
    rotatePts = backward.pts;
  } else if (forward.hit === "GG" && backward.hit === "G") {
    fixedPts  = backward.pts;
    rotatePts = forward.pts;
  } else {
    // fallback: GG와 가까운 끝점 쪽을 회전 조각으로
    const fEnd = forward.pts[forward.pts.length - 1];
    const bEnd = backward.pts[backward.pts.length - 1];
    const fDistGG = Math.hypot(fEnd.x - GG.x, fEnd.y - GG.y);
    const bDistGG = Math.hypot(bEnd.x - GG.x, bEnd.y - GG.y);
    if (fDistGG < bDistGG) { rotatePts = forward.pts;  fixedPts = backward.pts; }
    else                   { rotatePts = backward.pts; fixedPts = forward.pts;  }
  }

  // 미리보기용: BP와 cutPoint로 닫아서 조각처럼 보이게 한다
  const rotateClosed = [...rotatePts, { ...p.BP }, { ...cutPoint }];
  const fixedClosed  = [...fixedPts,  { ...p.BP }, { ...cutPoint }];

  return { fixedPts: fixedClosed, rotatePts: rotateClosed };
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
  const frontArm = sampleCubic(GG, FH.hFa, FH.hFb, FSP, 16);

  // ── segment 순서 (루프): nBR → WL → SideBtm → SideTop → G → [BP → GG disabled] → armhole → FSP → nTL → neckline → (nBR로 돌아옴)
  addLineSegment(segments, nBR,        p.FRONT_WL,  { type: "front-center"   });
  addLineSegment(segments, p.FRONT_WL, p.SIDE_BTM,  { type: "front-waist"    });
  addLineSegment(segments, p.SIDE_BTM, p.SIDE_TOP,  { type: "side-seam"      });
  addLineSegment(segments, p.SIDE_TOP, p.G,         { type: "side-to-dart"   });
  addLineSegment(segments, p.G,        p.BP,        { type: "old-dart", disabled: true });
  addLineSegment(segments, p.BP,       GG,          { type: "old-dart", disabled: true });
  addSampledSegments(segments, frontArm,             { type: "front-armhole"  });
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
  dartMoveState.active = true;
  dartMoveState.cutPoint = null;
  dartMoveState.cutSegIndex = -1;
  setBtn("취소", "#cc3333");
  setHint("앞판 외곽선을 클릭하세요");
  render();
}
function cancelDartMove() {
  dartMoveState.active = false;
  dartMoveState.cutPoint = null;
  dartMoveState.cutSegIndex = -1;
  setBtn("다트이동 시작", "#e07800");
  setHint("");
  render();
}
function resetDartMove()  { cancelDartMove(); }
function applyDartMove()  {}
function setDartTheta()   {}
function applyDartMoveToPoint(key, orig) { return orig; }

// ── 점 배열 → SVG polyline points 문자열 ──────
function ptsToSvgPoints(pts) {
  return pts.map(pt => { const [x, y] = c2p(pt.x, pt.y); return `${x},${y}`; }).join(" ");
}

// ── 오버레이 ──────────────────────────────────
function drawDartMoveOverlay(svg, p) {
  if (!dartMoveState.active) return;
  if (!dartMoveState.cutPoint) return;

  const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
  if (!B || !W || !BL) return;

  const g = E("g");
  const cut = dartMoveState.cutPoint;
  const [cx, cy] = c2p(cut.x, cut.y);
  const [bx, by] = c2p(p.BP.x, p.BP.y);

  const d = createDraft(B, W, BL);
  const segs = buildFrontOutline(d.pts, d.formula, B);

  // ── 선택 세그먼트 강조 ────────────────────────
  const seg = segs[dartMoveState.cutSegIndex];
  if (seg) {
    const [sx1, sy1] = c2p(seg.from.x, seg.from.y);
    const [sx2, sy2] = c2p(seg.to.x, seg.to.y);
    g.appendChild(E("line", {
      x1: sx1, y1: sy1, x2: sx2, y2: sy2,
      stroke: "#ffcc00", "stroke-width": 3, opacity: 0.85,
    }));
  }

  // ── closeAngle + 분할 ─────────────────────────
  const { closeAngle } = calcCloseAngle(p, B);
  const { rotatePts } = splitFrontOutline(
    segs,
    cut,
    dartMoveState.cutSegIndex,
    p,
    B
  );

  // non-CF 조각 → BP 중심으로 -closeAngle 회전
  const rotated = rotatePts.map(pt => rotatePt(pt, p.BP, closeAngle));

  // 파랑 점선 polyline (회전 미리보기)
  if (rotated.length >= 2) {
    g.appendChild(E("polyline", {
      points: ptsToSvgPoints(rotated),
      fill: "none",
      stroke: "#44aaff",
      "stroke-width": 2,
      opacity: 0.8,
      "stroke-dasharray": "5,3",
    }));
  }

  // ── BP→cutPoint 기존 절개선 (주황) ───────────
  g.appendChild(E("line", {
    x1: bx, y1: by, x2: cx, y2: cy,
    stroke: "#e07800", "stroke-width": 1.8, "stroke-dasharray": "6,3",
  }));

  // ── BP→cutPoint2 새 다트 다리 (파랑) ─────────
  const cut2 = rotatePt(cut, p.BP, closeAngle);
  const [cx2, cy2] = c2p(cut2.x, cut2.y);
  g.appendChild(E("line", {
    x1: bx, y1: by, x2: cx2, y2: cy2,
    stroke: "#44aaff", "stroke-width": 1.8, "stroke-dasharray": "6,3",
  }));

  // ── cutPoint 원 (주황) ────────────────────────
  g.appendChild(E("circle", { cx, cy, r: 7, fill: "#e07800", stroke: "#fff", "stroke-width": 2 }));

  // ── cutPoint2 원 (파랑) ───────────────────────
  g.appendChild(E("circle", { cx: cx2, cy: cy2, r: 7, fill: "#44aaff", stroke: "#fff", "stroke-width": 2 }));

  // ── 닫는 각도 표시 ────────────────────────────
  const deg = Math.abs(closeAngle * 180 / Math.PI).toFixed(1);
  const [lx, ly] = c2p(p.BP.x + 1.5, p.BP.y - 1.5);
  g.appendChild(E("text", {
    x: lx, y: ly, "font-size": 11, fill: "#44aaff",
    "font-weight": "700", "text-anchor": "start",
  }, `${deg}°`));

  svg.appendChild(g);
}

// ── 클릭 핸들러 ───────────────────────────────
function initDartMoveClickHandler() {
  if (window.__dartMoveClickHandlerReady) return;
  window.__dartMoveClickHandlerReady = true;

  svg.addEventListener("click", e => {
    if (!dartMoveState.active) return;
    const [cx, cy] = eventToPatternPoint(e);
    const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
    if (!B || !W || !BL) return;
    const d = createDraft(B, W, BL);
    const segments = buildFrontOutline(d.pts, d.formula, B);
    const result = findCutPoint({ x: cx, y: cy }, segments, d.pts);
    if (result?.blocked && result.reason === "dart-end") {
      setHint("기존 다트 끝점 G/GG 근처는 선택할 수 없습니다");
      render();
      return;
    }
    if (result) {
      dartMoveState.cutPoint = result.point;
      dartMoveState.cutSegIndex = result.segIndex;
      const seg = segments[result.segIndex];
      const { closeAngle } = calcCloseAngle(d.pts, B);
      const deg = Math.abs(closeAngle * 180 / Math.PI).toFixed(1);
      setHint(`${seg?.type || "outline"} · 닫힘각 ${deg}°`);
    } else {
      setHint(`앞판 외곽선 근처를 클릭하세요 x=${cx.toFixed(1)} y=${cy.toFixed(1)}`);
    }
    render();
  });
}

// ── UI 헬퍼 ───────────────────────────────────
function setBtn(txt, bg) {
  const b = document.getElementById("btnDartMove");
  if (b) { b.textContent = txt; b.style.background = bg; }
}
function setHint(txt) {
  const h = document.getElementById("dartMoveHint");
  if (h) h.textContent = txt;
}
