// ══════════════════════════════════════════════
// 다트이동 — 2단계: 외곽선 클릭 → cutPoint 표시
// ══════════════════════════════════════════════

const dartMoveState = {
  active:   false,
  cutPoint: null,
};

// ── 유틸 ──────────────────────────────────────
function closestOnSeg(pt, a, b) {
  const abx = b.x-a.x, aby = b.y-a.y;
  const L2 = abx*abx + aby*aby;
  if (L2 < 1e-10) return { pt:{...a}, d:Math.hypot(pt.x-a.x, pt.y-a.y) };
  const t = Math.max(0, Math.min(1, ((pt.x-a.x)*abx + (pt.y-a.y)*aby)/L2));
  const q = { x:a.x+t*abx, y:a.y+t*aby };
  return { pt:q, d:Math.hypot(pt.x-q.x, pt.y-q.y) };
}

// ── 앞판 외곽선 (직선 구간만) ─────────────────
// B → fSNP → fSP → GG → G → SIDE_TOP → SIDE_BTM → FRONT_WL → B
// GG→G 구간은 가슴다트 입 → 절개 불가
function buildFrontOutline(p) {
  return [
    { k:"B",        pt:{...p.B}        },
    { k:"fSNP",     pt:{...p.fSNP}     },
    { k:"fSP",      pt:{...p.fSP}      },
    { k:"GG",       pt:{...p.GG}       },
    // GG→G 절개 불가
    { k:"G",        pt:{...p.G}        },
    { k:"SIDE_TOP", pt:{...p.SIDE_TOP} },
    { k:"SIDE_BTM", pt:{...p.SIDE_BTM} },
    { k:"FRONT_WL", pt:{...p.FRONT_WL} },
  ];
}

// 클릭 좌표에서 가장 가까운 외곽선 위 점 찾기
function findCutPoint(clickPt, outline) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i+1) % outline.length];
    // GG→G 구간 제외
    if (a.k === "GG" && b.k === "G") continue;
    const r = closestOnSeg(clickPt, a.pt, b.pt);
    if (r.d < bestD) { bestD = r.d; best = r.pt; }
  }
  if (bestD > 3) return null; // 3cm 이상이면 무시
  return best;
}

// ── UI ────────────────────────────────────────
function toggleDartMove() {
  if (dartMoveState.active) cancelDartMove();
  else startDartMove();
}

function startDartMove() {
  dartMoveState.active = true;
  dartMoveState.cutPoint = null;
  setBtn("취소", "#cc3333");
  setHint("앞판 외곽선을 클릭하세요");
  render();
}

function cancelDartMove() {
  dartMoveState.active = false;
  dartMoveState.cutPoint = null;
  setBtn("다트이동 시작", "#e07800");
  setHint("");
  render();
}

function resetDartMove() { cancelDartMove(); }
function applyDartMove() {}
function setDartTheta() {}
function applyDartMoveToPoint(key, orig) { return orig; }

// ── 오버레이: cutPoint 주황 원 표시 ──────────
function drawDartMoveOverlay(svg, p) {
  if (!dartMoveState.active) return;
  if (!dartMoveState.cutPoint) return;

  const g = E("g");
  const [cx, cy] = c2p(dartMoveState.cutPoint.x, dartMoveState.cutPoint.y);
  g.appendChild(E("circle", {
    cx, cy, r: 7,
    fill: "#e07800", stroke: "#fff", "stroke-width": 2
  }));
  svg.appendChild(g);
}

// ── 클릭 핸들러 ───────────────────────────────
function initDartMoveClickHandler() {
  svg.addEventListener("click", e => {
    if (!dartMoveState.active) return;
    const [cx, cy] = eventToPatternPoint(e);
    const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
    if (!B || !W || !BL) return;
    const d = createDraft(B, W, BL);
    const outline = buildFrontOutline(d.pts);
    const cut = findCutPoint({x:cx, y:cy}, outline);
    if (cut) {
      dartMoveState.cutPoint = cut;
      setHint(`cutPoint x=${cut.x.toFixed(1)} y=${cut.y.toFixed(1)}`);
    } else {
      setHint(`외곽선 근처를 클릭하세요 (x=${cx.toFixed(1)} y=${cy.toFixed(1)})`);
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
