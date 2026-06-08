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

  if (L2 < 1e-10) {
    return { pt: { ...a }, d: Math.hypot(pt.x - a.x, pt.y - a.y) };
  }

  const t = Math.max(
    0,
    Math.min(1, ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / L2)
  );

  const q = {
    x: a.x + t * abx,
    y: a.y + t * aby,
  };

  return {
    pt: q,
    d: Math.hypot(pt.x - q.x, pt.y - q.y),
  };
}

function sampleCubic(p0, c0, c1, p1, n = 14) {
  const pts = [];

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;

    pts.push({
      x:
        mt * mt * mt * p0.x +
        3 * mt * mt * t * c0.x +
        3 * mt * t * t * c1.x +
        t * t * t * p1.x,
      y:
        mt * mt * mt * p0.y +
        3 * mt * mt * t * c0.y +
        3 * mt * t * t * c1.y +
        t * t * t * p1.y,
    });
  }

  return pts;
}

function addLineSegment(segments, from, to, meta = {}) {
  segments.push({
    from: { ...from },
    to: { ...to },
    ...meta,
  });
}

function addSampledSegments(segments, pts, meta = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    addLineSegment(segments, pts[i], pts[i + 1], meta);
  }
}

// ── 앞판 실제 패턴선 기준 외곽선 ───────────────
function buildFrontOutline(p, f, B) {
  const segments = [];

  const circ = f.fnw();
  const fnd = f.fnd();

  const nTR = { x: f.sw(), y: f.yB() };
  const nTL = { x: f.sw() - circ, y: f.yB() };
  const nBR = { x: f.sw(), y: f.yB() + fnd };
  const nBL = { x: f.sw() - circ, y: f.yB() + fnd };

  const deg22 = 22 * Math.PI / 180;
  const shLen = (nTL.x - (f.sw() - f.fw())) / Math.cos(deg22);

  const FSP = {
    x: nTL.x - (shLen + 1.8) * Math.cos(deg22),
    y: nTL.y + (shLen + 1.8) * Math.sin(deg22),
  };

  const vx = p.BP.x - p.G.x;
  const vy = p.BP.y - p.G.y;
  const len = Math.hypot(vx, vy) || 1;
  const ux = -vx / len;
  const uy = -vy / len;
  const da = (B / 4 - 2.5) * Math.PI / 180;

  const GG = {
    x: p.BP.x + (ux * Math.cos(da) - uy * Math.sin(da)) * len,
    y: p.BP.y + (ux * Math.sin(da) + uy * Math.cos(da)) * len,
  };

  const diagLen = Math.hypot(nBL.x - nTR.x, nBL.y - nTR.y) || 1;
  const diagUx = (nBL.x - nTR.x) / diagLen;
  const diagUy = (nBL.y - nTR.y) / diagLen;

  const div2 = {
    x: nTR.x + (nBL.x - nTR.x) * (2 / 3),
    y: nTR.y + (nBL.y - nTR.y) * (2 / 3),
  };

  const guideP = {
    x: div2.x + diagUx * 0.5,
    y: div2.y + diagUy * 0.5,
  };

  const FN = state.fNeckH || {
    h0: { x: nBR.x, y: nBR.y },
    h1: { x: nTL.x, y: nTL.y },
  };

  const tgx = -(guideP.y - nTR.y);
  const tgy = guideP.x - nTR.x;
  const tgLen = Math.hypot(tgx, tgy) || 1;
  const tx = tgx / tgLen;
  const ty = tgy / tgLen;

  const d1 = Math.hypot(guideP.x - nBR.x, guideP.y - nBR.y) * 0.25;
  const d2 = Math.hypot(nTL.x - guideP.x, nTL.y - guideP.y) * 0.25;

  const c2 = { x: guideP.x - tx * d1, y: guideP.y - ty * d1 };
  const c3 = { x: guideP.x + tx * d2, y: guideP.y + ty * d2 };

  const neck1 = sampleCubic(nBR, FN.h0, c2, guideP, 10);
  const neck2 = sampleCubic(guideP, c3, FN.h1, nTL, 10);
  const neckAll = [...neck1, ...neck2.slice(1)];

  const FH = state.fArmH || {
    hFa: { x: GG.x, y: GG.y },
    hFb: { x: FSP.x, y: FSP.y },
  };

  const frontArm = sampleCubic(GG, FH.hFa, FH.hFb, FSP, 16);

  addLineSegment(segments, nBR, p.FRONT_WL, { type: "front-center" });
  addLineSegment(segments, p.FRONT_WL, p.SIDE_BTM, { type: "front-waist" });
  addLineSegment(segments, p.SIDE_BTM, p.SIDE_TOP, { type: "side-seam" });
  addLineSegment(segments, p.SIDE_TOP, p.G, { type: "side-to-dart" });
  addLineSegment(segments, p.G, p.BP, { type: "old-dart", disabled: true });
  addLineSegment(segments, p.BP, GG, { type: "old-dart", disabled: true });
  addSampledSegments(segments, frontArm, { type: "front-armhole" });
  addLineSegment(segments, FSP, nTL, { type: "front-shoulder" });

  const neckReverse = [...neckAll].reverse();
  addSampledSegments(segments, neckReverse, { type: "front-neckline" });

  return segments;
}

function findCutPoint(clickPt, segments) {
  let best = null;
  let bestD = Infinity;
  let bestIndex = -1;

  segments.forEach((seg, idx) => {
    if (seg.disabled) return;
    const r = closestOnSeg(clickPt, seg.from, seg.to);
    if (r.d < bestD) {
      bestD = r.d;
      best = r.pt;
      bestIndex = idx;
    }
  });

  if (bestD > 2.0) return null;

  return { point: best, segIndex: bestIndex, distance: bestD };
}

// ── UI ────────────────────────────────────────
function toggleDartMove() {
  if (dartMoveState.active) cancelDartMove();
  else startDartMove();
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

function resetDartMove() { cancelDartMove(); }
function applyDartMove() {}
function setDartTheta() {}
function applyDartMoveToPoint(key, orig) { return orig; }

// ── 오버레이 ──────────────────────────────────
function drawDartMoveOverlay(svg, p) {
  if (!dartMoveState.active) return;
  if (!dartMoveState.cutPoint) return;

  const g = E("g");
  const cut = dartMoveState.cutPoint;
  const [cx, cy] = c2p(cut.x, cut.y);
  const [bx, by] = c2p(p.BP.x, p.BP.y);

  if (dartMoveState.cutSegIndex >= 0) {
    const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
    if (B && W && BL) {
      const d = createDraft(B, W, BL);
      const segs = buildFrontOutline(d.pts, d.formula, B);
      const seg = segs[dartMoveState.cutSegIndex];
      if (seg) {
        const [sx1, sy1] = c2p(seg.from.x, seg.from.y);
        const [sx2, sy2] = c2p(seg.to.x, seg.to.y);
        g.appendChild(E("line", {
          x1: sx1, y1: sy1, x2: sx2, y2: sy2,
          stroke: "#ffcc00", "stroke-width": 3, opacity: 0.85,
        }));
      }
    }
  }

  g.appendChild(E("line", {
    x1: bx, y1: by, x2: cx, y2: cy,
    stroke: "#e07800", "stroke-width": 1.8, "stroke-dasharray": "6,3",
  }));

  g.appendChild(E("circle", {
    cx, cy, r: 7,
    fill: "#e07800", stroke: "#fff", "stroke-width": 2,
  }));

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
    const result = findCutPoint({ x: cx, y: cy }, segments);
    if (result) {
      dartMoveState.cutPoint = result.point;
      dartMoveState.cutSegIndex = result.segIndex;
      const seg = segments[result.segIndex];
      setHint(`cutPoint x=${result.point.x.toFixed(1)} y=${result.point.y.toFixed(1)} · ${seg?.type || "outline"}`);
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
