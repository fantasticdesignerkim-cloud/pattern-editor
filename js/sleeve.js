function calcArmholeLengths(f,p,B){
  let bAH = 0, fAH = 0;

  if(state.armH){
    const H = state.armH;
    const bND = {x:f.bnw(), y:-f.bnd()};
    const fSNP = {x:f.sw()-f.fnw(), y:f.yB()};
    const armX = f.sw()-f.fw();
    const fSh = (fSNP.x-armX)/Math.cos(22*Math.PI/180)+1.8;
    const bSh = fSh+B/32-0.8;
    const d18 = 18*Math.PI/180;
    const bSP = {x:bND.x+bSh*Math.cos(d18), y:bND.y+bSh*Math.sin(d18)};
    const sc = SC*viewZ;
    const cp = pt => [MX+viewX+pt.x*sc, MY+viewY+pt.y*sc];
    const anchors = [bSP, H.a1, H.a2, H.a3, p.G];
    const ghost0 = {x:anchors[0].x-Math.sin(d18)*3, y:anchors[0].y+Math.cos(d18)*3};
    const ghostN = {x:anchors[4].x, y:anchors[4].y+3};
    const pts = [ghost0, ...anchors, ghostN];
    const alpha = 0.5;

    for(let i=1; i<pts.length-2; i++){
      const [ax,ay] = cp(pts[i-1]);
      const [bx,by] = cp(pts[i]);
      const [cx,cy] = cp(pts[i+1]);
      const [dx,dy] = cp(pts[i+2]);
      const cp1x = bx+(cx-ax)*alpha/3, cp1y = by+(cy-ay)*alpha/3;
      const cp2x = cx-(dx-bx)*alpha/3, cp2y = cy-(dy-by)*alpha/3;
      const seg = bezierLen([[bx,by],[cp1x,cp1y],[cp2x,cp2y],[cx,cy]])/sc;
      if(i<=2) bAH += seg; else fAH += seg;
    }
  }

  if(state.fArmH){
    const FH = state.fArmH;
    const nTL = {x:f.sw()-f.fnw(), y:f.yB()};
    const armX = f.sw()-f.fw();
    const sh = (nTL.x-armX)/Math.cos(22*Math.PI/180);
    const FSP = {x:nTL.x-(sh+1.8)*Math.cos(22*Math.PI/180), y:nTL.y+(sh+1.8)*Math.sin(22*Math.PI/180)};
    const vx = p.BP.x-p.G.x, vy = p.BP.y-p.G.y;
    const len = Math.hypot(vx,vy);
    const ux = -vx/len, uy = -vy/len;
    const da = (B/4-2.5)*Math.PI/180;
    const GG = {x:p.BP.x+(ux*Math.cos(da)-uy*Math.sin(da))*len, y:p.BP.y+(ux*Math.sin(da)+uy*Math.cos(da))*len};
    const sc = SC*viewZ;
    const cp = pt => [MX+viewX+pt.x*sc, MY+viewY+pt.y*sc];
    const [gx,gy] = cp(GG);
    const [fx,fy] = cp(FSP);
    const [hfax,hfay] = cp(FH.hFa);
    const [hfbx,hfby] = cp(FH.hFb);
    fAH += bezierLen([[gx,gy],[hfax,hfay],[hfbx,hfby],[fx,fy]])/sc;
  }

  return { bAH: bAH || 19, fAH: fAH || 17 };
}

function calcSleeveShoulderMetrics(f,p,B){
  const dartAngle = (B/4 - 2.5) * Math.PI / 180;
  const fSNP = {x: f.sw()-f.fnw(), y: f.yB()};
  const armX = f.sw()-f.fw();
  const shLen = (fSNP.x-armX)/Math.cos(22*Math.PI/180);
  const FSP = {
    x: fSNP.x - (shLen+1.8)*Math.cos(22*Math.PI/180),
    y: fSNP.y + (shLen+1.8)*Math.sin(22*Math.PI/180)
  };
  const dx = FSP.x - p.BP.x, dy = FSP.y - p.BP.y;
  const FSP_closed = {
    x: p.BP.x + dx*Math.cos(dartAngle) - dy*Math.sin(dartAngle),
    y: p.BP.y + dx*Math.sin(dartAngle) + dy*Math.cos(dartAngle)
  };

  const bND = {x:f.bnw(), y:-f.bnd()};
  const fSh = (fSNP.x-armX)/Math.cos(22*Math.PI/180)+1.8;
  const bSh = fSh + B/32 - 0.8;
  const d18 = 18*Math.PI/180;
  const BSP = {
    x: bND.x + bSh*Math.cos(d18),
    y: bND.y + bSh*Math.sin(d18)
  };

  // 문화식 소매산 높이는 앞다트 닫힘 후 회전점이 아니라
  // 원형 제도 상태의 앞어깨점(FSP)과 뒤어깨점(BSP) 높이 기준으로 계산한다.
  const fSH = f.yBL() - FSP.y;
  const bSH = f.yBL() - BSP.y;
  // 문화식 소매산 높이: B/12 + 3.5
  // 이전의 어깨높이 평균×5/6 방식은 추천식/변형식에 가까워서 문화식에서 제외
  const SCH = B / 12 + 3.5;
  return { FSP_closed, FSP, BSP, fSH, bSH, SCH };
}


function getSleeveAlpha(B){
  // 문화식 표 기준 ★(알파) 값: B가 커질수록 뒤소매 여유를 추가한다.
  // 표 기준: 77~84=0.0, 85~89=0.1, 90~94=0.2, 95~99=0.3, 100~104=0.4
  if(B < 85) return 0.0;
  if(B < 90) return 0.1;
  if(B < 95) return 0.2;
  if(B < 100) return 0.3;
  return 0.4;
}

function calcBackSleeveTargetLength(B, backArmholeLen){
  const alpha = getSleeveAlpha(B);
  return { alpha, target: backArmholeLen + 1 + alpha };
}

function calcSleeveCapHeights(f,p,B,bAH,fAH){
  const metrics = calcSleeveShoulderMetrics(f,p,B);
  const culture = metrics.SCH;                         // 문화식: B/12 + 3.5
  const recommended = (bAH + fAH) / 4 - 1;             // 추천식: 앞/뒤 진동길이 반응형 공식
  return { culture, recommended, metrics };
}

function getSelectedSleeveCapHeight(f,p,B,bAH,fAH){
  const cap = calcSleeveCapHeights(f,p,B,bAH,fAH);
  const mode = document.getElementById("selCapFormula")?.value || "culture";
  const capAdj = +document.getElementById("inpCapAdj")?.value || 0;
  const base = mode === "culture" ? cap.culture : cap.recommended;
  return { ...cap, mode, capAdj, base, final: Math.max(4, base + capAdj) };
}

function calcFrontClosedSleeveGuideLine(f,p,B){
  // 앞진동은 두 구간을 함께 복사해야 한다.
  // 1) 옆가슴점(SIDE_TOP) → G : 몸판 진동선의 앞쪽 하부 곡선
  // 2) GG → 앞옆어깨점(FSP) : 앞다트를 닫은 뒤의 앞쪽 상부 곡선
  const deg22 = 22 * Math.PI / 180;
  const fSNP = { x: f.sw() - f.fnw(), y: f.yB() };
  const armX = f.sw() - f.fw();
  const shLen = (fSNP.x - armX) / Math.cos(deg22);
  const FSP = {
    x: fSNP.x - (shLen + 1.8) * Math.cos(deg22),
    y: fSNP.y + (shLen + 1.8) * Math.sin(deg22)
  };

  const dartAngle = (B / 4 - 2.5) * Math.PI / 180;
  const vx = p.BP.x - p.G.x;
  const vy = p.BP.y - p.G.y;
  const len = Math.hypot(vx, vy);
  const ux = -vx / len;
  const uy = -vy / len;
  const GG = {
    x: p.BP.x + (ux * Math.cos(dartAngle) - uy * Math.sin(dartAngle)) * len,
    y: p.BP.y + (ux * Math.sin(dartAngle) + uy * Math.cos(dartAngle)) * len
  };

  // 앞 다트를 닫는 회전. GG가 G 위치로 닫히는 방향이다.
  const closeAngle = -dartAngle;
  const rot = (pt) => {
    const dx = pt.x - p.BP.x;
    const dy = pt.y - p.BP.y;
    return {
      x: p.BP.x + dx * Math.cos(closeAngle) - dy * Math.sin(closeAngle),
      y: p.BP.y + dx * Math.sin(closeAngle) + dy * Math.cos(closeAngle)
    };
  };

  const closedG = rot(GG);
  const closedFSP = rot(FSP);

  // 하부 앞진동: 옆가슴점 → F안내점 → G 구간은 state.armH의 a2→a3→G를 사용한다.
  const H = state.armH;
  const lowerFrontArmhole = H ? {
    sideTop: p.SIDE_TOP, // ★ 공식 기반 p.SIDE_TOP 사용 (H.a2 편집 시 위치 오류 방지)
    h2b: H.h2b,
    h3a: H.h3a,
    a3: H.a3,
    h3b: H.h3b,
    h4: H.h4,
    G: p.G
  } : null;

  // 상부 앞진동: GG → FSP 구간은 state.fArmH를 앞다트 닫힘 상태로 회전해서 사용한다.
  const FH = state.fArmH;
  const upperFrontArmhole = FH ? {
    start: closedG,
    hFa: rot(FH.hFa),
    hFb: rot(FH.hFb),
    end: closedFSP
  } : null;

  return {
    G: p.G,
    GG,
    FSP,
    start: closedG,
    end: closedFSP,
    lowerFrontArmhole,
    upperFrontArmhole
  };
}

function calcBackSleeveGuideLine(f,p,B){
  // 뒤판의 다트끝 → 뒤어깨점(BSP) → 옆가슴점(SIDE_TOP)을
  // 소매 패턴 보조선으로 복사하기 위한 기준점 계산
  // 주의: BSP → 옆가슴점은 직선이 아니라, 마지막으로 저장된 뒤진동선 베지어를 그대로 사용한다.
  const deg18 = 18 * Math.PI / 180;
  const bND = { x: f.bnw(), y: -f.bnd() };
  const fSNP = { x: f.sw() - f.fnw(), y: f.yB() };
  const armX = f.sw() - f.fw();
  const fShLen = (fSNP.x - armX) / Math.cos(22 * Math.PI / 180) + 1.8;
  const bShLen = fShLen + B / 32 - 0.8;
  const BSP = {
    x: bND.x + bShLen * Math.cos(deg18),
    y: bND.y + bShLen * Math.sin(deg18)
  };

  const shDx = Math.cos(deg18);
  const shDy = Math.sin(deg18);
  const t = (p.E.x - bND.x) / shDx;
  const dartCenterT = t + 1.5;
  const dartCenter = {
    x: bND.x + dartCenterT * shDx,
    y: bND.y + dartCenterT * shDy
  };
  const dartLen = B / 32 - 0.8;
  const dartEnd = {
    x: dartCenter.x + dartLen * shDx,
    y: dartCenter.y + dartLen * shDy
  };

  // state.armH가 있으면 사용자가 마지막으로 저장/조정한 뒤진동선의
  // BSP → C안내(a1) → 옆가슴점(a2) 구간을 그대로 복사한다.
  // 없으면 초기값 기준으로만 fallback한다.
  const H = state.armH;
  // ★ 매핑 기준은 항상 공식 기반 p.SIDE_TOP 사용 (H.a2 편집 시 위치 오류 방지)
  const sideTop = p.SIDE_TOP;
  const backArmhole = H ? {
    start: BSP,
    h0: H.h0,
    h1a: H.h1a,
    a1: H.a1,
    h1b: H.h1b,
    h2a: H.h2a,
    end: sideTop
  } : null;

  return { dartEnd, BSP, sideTop, backArmhole };
}

// ── 소매 그리기 ──────────────────────────────
function drawSleeve(svg,f,p,dr,B,W,BL,showBase=true,showDart=true,showDep=true,showPattern=true,showDim=true){
  const SL = n("inpSL");
  const hemCirc = n("inpHem");
  const capAdjVal = document.getElementById("capAdjVal");
  if(capAdjVal) capAdjVal.textContent = n("inpCapAdj").toFixed(1);
  if(!SL || !hemCirc) return;

  const { bAH, fAH } = calcArmholeLengths(f,p,B);
  const capInfo = getSelectedSleeveCapHeight(f,p,B,bAH,fAH);
  const { FSP_closed, BSP, fSH, bSH } = capInfo.metrics;
  const hemHalf = hemCirc / 2;
  const capAdj = capInfo.capAdj;
  const baseCapHeight = capInfo.base;
  const finalCapHeight = capInfo.final;
  if(capAdjVal) capAdjVal.textContent = capAdj.toFixed(1);
  const sd = createSleeveDraft(B, SL, bAH, fAH, finalCapHeight);
  const sf = sd.formula;

  // ── 소매 배치: WL 아래 15cm ─────────────────
  const sy_SP   = f.yWL() + 15;
  const sy_base = sy_SP + sf.SCH();
  const sx_C = sf.ox();
  const sx_B = sx_C - sf.bSW();
  const sx_F = sx_C + sf.fSW();

  const g = E("g");
  const sy_EL   = sy_SP + sf.EL(); // EL = 소매산점에서 아래로 소매길이/2 + 2.5
  const sy_HEM  = sy_SP + sf.SL(); // 소매길이선 = 소매산점에서 아래로 소매길이

  // ── 기초선 ──────────────────────────────────
  g.appendChild(Ln({x:sx_B,y:sy_base},{x:sx_F,y:sy_base},"base"));
  g.appendChild(Ln({x:sx_C,y:sy_SP},{x:sx_C,y:sy_HEM},"base"));
  g.appendChild(Ln({x:sx_B,y:sy_EL},{x:sx_F,y:sy_EL},"base"));
  g.appendChild(lbl({x:sx_F+1,y:sy_EL},`EL ${sf.EL().toFixed(1)}cm`,"txt-dark",4,3));
  g.appendChild(Ln({x:sx_B,y:sy_HEM},{x:sx_F,y:sy_HEM},"base"));
  g.appendChild(lbl({x:sx_F+1,y:sy_HEM},`SL ${sf.SL().toFixed(1)}cm`,"txt-dark",4,3));
  g.appendChild(Ln({x:sx_B,y:sy_base},{x:sx_B,y:sy_HEM},"base"));
  g.appendChild(Ln({x:sx_F,y:sy_base},{x:sx_F,y:sy_HEM},"base"));

  const SP = {x:sx_C, y:sy_SP};
  g.appendChild(dot(SP,"pt-main",3));
  g.appendChild(lbl(SP,"소매산","txt-dark",5,-5));

  const SG = {x:sx_C, y:sy_base};
  g.appendChild(dot(SG,"pt-dep",3));
  g.appendChild(lbl(SG,"G","txt-dep",5,-5));

  const cubicAt = (p0,h1,h2,p1,t) => {
    const mt = 1 - t;
    return {
      x: mt*mt*mt*p0.x + 3*mt*mt*t*h1.x + 3*mt*t*t*h2.x + t*t*t*p1.x,
      y: mt*mt*mt*p0.y + 3*mt*mt*t*h1.y + 3*mt*t*t*h2.y + t*t*t*p1.y
    };
  };
  let sleeveBackCurveSamples = null;
  let sleeveBackCircPt = null;
  const sleevePatPts = {}; // 실제 소매 패턴선 기준 앵커 모음

  // ── 문화식 앞소매 둘레 구하기 보조선 ─────────────
  // 공식 개념: 소매산점(SP)에서 앞진동길이(fAH)를 반지름처럼 잡고,
  // 소매 BL 라인(sy_base)과 만나는 점을 앞소매 둘레점으로 본다.
  // 수평거리 = √(앞진동길이² - 소매산높이²)
  {
    const capH = sf.SCH();
    const frontRadius = fAH;
    const frontDx = Math.sqrt(Math.max(0, frontRadius*frontRadius - capH*capH));
    const frontCircPt = { x: sx_C + frontDx, y: sy_base };
    sleevePatPts.frontCircPt = frontCircPt;

    g.appendChild(Ln(SP, frontCircPt, "sleeve-front-circ"));
    g.appendChild(Ln({x:frontCircPt.x,y:sy_base-1.2},{x:frontCircPt.x,y:sy_base+1.2},"sleeve-front-circ-light"));
    g.appendChild(dot(frontCircPt,"pt-main",3.5));
    g.appendChild(lbl(frontCircPt,`앞둘레점`,"txt-dark",5,-7));
    g.appendChild(lbl({x:(SP.x+frontCircPt.x)/2,y:(SP.y+frontCircPt.y)/2},`앞진동 ${fAH.toFixed(1)}cm`,"sleeve-guide-label",5,-5));
    g.appendChild(lbl({x:(SG.x+frontCircPt.x)/2,y:sy_base+1.2},`BL교점 폭 ${frontDx.toFixed(1)}cm`,"sleeve-guide-label",-20,10));

    if(frontRadius <= capH){
      g.appendChild(lbl({x:frontCircPt.x,y:frontCircPt.y+2.4},"앞진동길이가 소매산높이보다 짧음", "txt-dark",5,8));
    }
  }

  // ── 문화식 앞소매산 보조점: 앞암홀/4 지점에서 바깥직각 1.9cm ──
  // 기준: 소매산점(SP)에서 앞방향 보조선(SP→앞둘레점) 위로 앞암홀/4만큼 이동,
  // 그 점에서 바깥방향 직각으로 1.9cm 이동한 점을 만든다.
  {
    const capH = sf.SCH();
    const frontRadius = fAH;
    const frontDx = Math.sqrt(Math.max(0, frontRadius*frontRadius - capH*capH));
    const frontCircPt = { x: sx_C + frontDx, y: sy_base };
    sleevePatPts.frontCircPt = frontCircPt;

    const vx = frontCircPt.x - SP.x;
    const vy = frontCircPt.y - SP.y;
    const vLen = Math.hypot(vx, vy) || 1;
    const ux = vx / vLen;
    const uy = vy / vLen;

    // 앞방향 보조선 위에서 앞암홀/4 지점
    const qDist = fAH / 4;
    const q = { x: SP.x + ux*qDist, y: SP.y + uy*qDist };

    // 바깥방향 직각: 앞소매 기준 오른쪽/위쪽 방향
    const out = { x: uy, y: -ux };
    const qOut = { x: q.x + out.x*1.9, y: q.y + out.y*1.9 };
    sleevePatPts.frontQOut = qOut;

    g.appendChild(Ln(SP, q, "sleeve-culture-aux"));
    g.appendChild(Ln(q, qOut, "sleeve-culture-aux"));
    const [qx,qy] = c2p(q.x,q.y);
    const [qox,qoy] = c2p(qOut.x,qOut.y);
    g.appendChild(E("circle",{cx:qx,cy:qy,r:3.2,class:"sleeve-culture-aux-point"}));
    g.appendChild(E("circle",{cx:qox,cy:qoy,r:3.8,class:"sleeve-culture-aux-point"}));
    g.appendChild(lbl(q, `앞AH/4 ${(qDist).toFixed(1)}`, "txt-dark", 5, -5));
    g.appendChild(lbl(qOut, "직각 1.9", "txt-dark", 5, -5));
  }

  // ── 문화식 뒤소매 둘레 구하기 보조선 ─────────────
  // 공식 개념: 뒤소매 목표길이 = 뒤진동길이 + 1cm + α
  // 소매산점(SP)에서 목표길이를 반지름처럼 잡고,
  // 소매 BL 라인(sy_base)과 만나는 점을 뒤둘레점으로 본다.
  {
    const capH = sf.SCH();
    const backTargetInfo = calcBackSleeveTargetLength(B, bAH);
    const backRadius = backTargetInfo.target;
    const backDx = Math.sqrt(Math.max(0, backRadius*backRadius - capH*capH));
    const backCircPt = { x: sx_C - backDx, y: sy_base };
    sleeveBackCircPt = backCircPt;
    sleevePatPts.backCircPt = backCircPt;

    g.appendChild(Ln(SP, backCircPt, "sleeve-back-circ"));
    g.appendChild(Ln({x:backCircPt.x,y:sy_base-1.2},{x:backCircPt.x,y:sy_base+1.2},"sleeve-back-circ-light"));
    g.appendChild(dot(backCircPt,"pt-main",3.5));
    g.appendChild(lbl(backCircPt,`뒤둘레점`,"txt-dark",-38,-7));
    g.appendChild(lbl({x:(SP.x+backCircPt.x)/2,y:(SP.y+backCircPt.y)/2},`뒤진동 ${bAH.toFixed(1)} +1 +α${backTargetInfo.alpha.toFixed(1)} = ${backRadius.toFixed(1)}cm`,"sleeve-guide-label",-65,-5));
    g.appendChild(lbl({x:(SG.x+backCircPt.x)/2,y:sy_base+1.2},`BL교점 폭 ${backDx.toFixed(1)}cm`,"sleeve-guide-label",-24,10));

    // 문화식 뒤소매산 보조점: 소매산에서 앞암홀/4 지점, 바깥 직각 2cm
    {
      const vx = backCircPt.x - SP.x;
      const vy = backCircPt.y - SP.y;
      const vLen = Math.hypot(vx, vy) || 1;
      const ux = vx / vLen;
      const uy = vy / vLen;
      const qDist = fAH / 4;
      const q = { x: SP.x + ux*qDist, y: SP.y + uy*qDist };
      // 뒤소매 기준 바깥방향 = 왼쪽/위쪽 직각
      const out = { x: -uy, y: ux };
      const qOut = { x: q.x + out.x*2.0, y: q.y + out.y*2.0 };
      sleevePatPts.backQOut = qOut;
      g.appendChild(Ln(SP, q, "sleeve-culture-aux"));
      g.appendChild(Ln(q, qOut, "sleeve-culture-aux"));
      const [qx,qy] = c2p(q.x,q.y);
      const [qox,qoy] = c2p(qOut.x,qOut.y);
      g.appendChild(E("circle",{cx:qx,cy:qy,r:3.2,class:"sleeve-culture-aux-point"}));
      g.appendChild(E("circle",{cx:qox,cy:qoy,r:3.8,class:"sleeve-culture-aux-point"}));
      g.appendChild(lbl(q, `뒤보조 앞AH/4 ${(qDist).toFixed(1)}`, "txt-dark", -55, -5));
      g.appendChild(lbl(qOut, "직각 2.0", "txt-dark", -45, -5));
    }

    if(backRadius <= capH){
      g.appendChild(lbl({x:backCircPt.x,y:backCircPt.y+2.4},"뒤목표길이가 소매산높이보다 짧음", "txt-dark",-65,8));
    }
  }

  g.appendChild(lbl({x:sx_C,y:sy_SP-1.5},"소매산 진동 복사 보조선", "sleeve-guide-label",-45,-5));

  // ── 소매 보조선: 뒤판 다트끝 → 뒤어깨점 → 옆가슴점을 복사해서 G점으로 이동
  {
    const guide = calcBackSleeveGuideLine(f,p,B);
    const moveX = SG.x - guide.sideTop.x;
    const moveY = SG.y - guide.sideTop.y;
    const toSleeve = pt => ({ x: pt.x + moveX, y: pt.y + moveY });
    const sDartEnd = toSleeve(guide.dartEnd);
    const sBSP = toSleeve(guide.BSP);

    // 다트끝 → BSP는 원래 직선, BSP → 옆가슴점은 저장된 뒤진동선 곡선으로 복사
    g.appendChild(Ln(sDartEnd, sBSP, "dep"));

    if(guide.backArmhole){
      const bh = guide.backArmhole;
      // 뒤진동도 소매에서는 "옆가슴점(SG) → 뒤어깨점(BSP)" 방향으로 보여야 한다.
      // 원본 저장선은 BSP → a1 → 옆가슴점 방향이므로 베지어를 역순으로 복사한다.
      const p0  = SG;                 // 공통 시작점 = 소매 옆가슴점
      const h0  = toSleeve(bh.h2a);   // reverse control 1
      const h1  = toSleeve(bh.h1b);   // reverse control 2
      const a1  = toSleeve(bh.a1);
      const h2  = toSleeve(bh.h1a);   // reverse control 1
      const h3  = toSleeve(bh.h0);    // reverse control 2
      const p2  = toSleeve(bh.start); // 끝점 = 뒤어깨점(BSP)
      const [x0,y0] = c2p(p0.x,p0.y);
      const [h0x,h0y] = c2p(h0.x,h0.y);
      const [h1x,h1y] = c2p(h1.x,h1.y);
      const [a1x,a1y] = c2p(a1.x,a1.y);
      const [h2x,h2y] = c2p(h2.x,h2.y);
      const [h3x,h3y] = c2p(h3.x,h3.y);
      const [x2,y2] = c2p(p2.x,p2.y);
      const dBack = `M${x0},${y0} C${h0x},${h0y} ${h1x},${h1y} ${a1x},${a1y}`+
                    ` C${h2x},${h2y} ${h3x},${h3y} ${x2},${y2}`;
      g.appendChild(E("path",{d:dBack,class:"sleeve-back-guide"}));
      sleeveBackCurveSamples = [];
      for(let i=0;i<=90;i++) sleeveBackCurveSamples.push(cubicAt(p0,h0,h1,a1,i/90));
      for(let i=1;i<=90;i++) sleeveBackCurveSamples.push(cubicAt(a1,h2,h3,p2,i/90));
    } else {
      // fallback: 핸들이 아직 없을 때도 시작점은 SG, 끝점은 BSP로 맞춘다.
      g.appendChild(Ln(SG, sBSP, "sleeve-back-guide"));
      sleeveBackCurveSamples = [SG, sBSP];
    }

    g.appendChild(dot(sDartEnd, "pt-dep", 3));
    g.appendChild(dot(sBSP, "pt-dep", 3));
    g.appendChild(lbl(sDartEnd, "뒤다트끝 복사", "txt-dep", 5, -5));
    g.appendChild(lbl(sBSP, "BSP 복사", "txt-dep", 5, -5));
  }

  // ── 소매 보조선: 앞진동 두 구간을 함께 복사
  // 기준: 앞/뒤진동 모두 시작점은 같은 소매 옆가슴점(SG)이다.
  // 앞진동은 "옆가슴점 → G" 하부 구간과 "닫힌 GG → FSP" 상부 구간을 연결해서 가져온다.
  {
    const guide = calcFrontClosedSleeveGuideLine(f,p,B);
    // ★ 매핑 기준은 항상 공식 기반 p.SIDE_TOP 사용
    // H.a2(사용자 편집 앵커)를 기준으로 쓰면 앵커 이동 시 앞진동 보조선이 뒤쪽으로 넘어가는 오류 발생
    const sideTop0 = p.SIDE_TOP;

    // 앞진동은 소매의 앞쪽으로 펼쳐지도록 옆가슴점을 SG에 붙여 평행이동한다.
    // 여기서 붙는 기준점은 G/GG가 아니라 항상 옆가슴점이다.
    const toFrontFromSide = pt => ({
      x: SG.x + (pt.x - sideTop0.x),
      y: SG.y + (pt.y - sideTop0.y)
    });

    let frontJoin = toFrontFromSide(guide.G); // 하부 끝 = G 복사점

    // ① 옆가슴점 → G 구간: 원본 방향 그대로 SG에서 시작한다.
    if(guide.lowerFrontArmhole){
      const lh = guide.lowerFrontArmhole;
      const p0 = SG;
      const h1 = toFrontFromSide(lh.h2b);
      const h2 = toFrontFromSide(lh.h3a);
      const a3 = toFrontFromSide(lh.a3);
      const h3 = toFrontFromSide(lh.h3b);
      const h4 = toFrontFromSide(lh.h4);
      const p2 = toFrontFromSide(lh.G);
      frontJoin = p2;

      const [x0,y0] = c2p(p0.x,p0.y);
      const [h1x,h1y] = c2p(h1.x,h1.y);
      const [h2x,h2y] = c2p(h2.x,h2.y);
      const [a3x,a3y] = c2p(a3.x,a3.y);
      const [h3x,h3y] = c2p(h3.x,h3.y);
      const [h4x,h4y] = c2p(h4.x,h4.y);
      const [x2,y2] = c2p(p2.x,p2.y);

      const dLower = `M${x0},${y0} C${h1x},${h1y} ${h2x},${h2y} ${a3x},${a3y}`+
                     ` C${h3x},${h3y} ${h4x},${h4y} ${x2},${y2}`;
      g.appendChild(E("path",{d:dLower,class:"sleeve-front-guide"}));
    } else {
      frontJoin = toFrontFromSide(p.G);
      g.appendChild(Ln(SG, frontJoin, "sleeve-front-guide"));
    }

    // ② 닫힌 GG → 앞옆어깨점(FSP) 구간:
    // 다트를 닫은 뒤의 GG 시작점을 방금 복사한 G점(frontJoin)에 붙인다.
    const toFrontFromClosedG = pt => ({
      x: frontJoin.x + (pt.x - guide.start.x),
      y: frontJoin.y + (pt.y - guide.start.y)
    });

    if(guide.upperFrontArmhole){
      const uh = guide.upperFrontArmhole;
      const p0 = frontJoin;
      const h1 = toFrontFromClosedG(uh.hFa);
      const h2 = toFrontFromClosedG(uh.hFb);
      const p1 = toFrontFromClosedG(uh.end);
      const [x0,y0] = c2p(p0.x, p0.y);
      const [h1x,h1y] = c2p(h1.x, h1.y);
      const [h2x,h2y] = c2p(h2.x, h2.y);
      const [x1,y1] = c2p(p1.x, p1.y);
      const dUpper = `M${x0},${y0} C${h1x},${h1y} ${h2x},${h2y} ${x1},${y1}`;
      g.appendChild(E("path",{d:dUpper,class:"sleeve-front-guide"}));
      g.appendChild(dot(p1, "pt-dep", 3));
      g.appendChild(lbl(p1, "FSP 복사", "txt-dep", 5, -5));
    } else {
      const p1 = toFrontFromClosedG(guide.end);
      g.appendChild(Ln(frontJoin, p1, "sleeve-front-guide"));
      g.appendChild(dot(p1, "pt-dep", 3));
      g.appendChild(lbl(p1, "FSP 복사", "txt-dep", 5, -5));
    }

    g.appendChild(dot(frontJoin, "pt-dep", 3));
    g.appendChild(lbl(SG, "공통 옆가슴점", "txt-dep", 5, 12));
    g.appendChild(lbl(frontJoin, "G/닫힌GG 연결", "txt-dep", 5, -5));
    sleevePatPts.gY = frontJoin.y;

    // ── 문화식 앞소매 추가 보조선 ─────────────────
    // 1) G점 높이의 수평보조선
    // 2) 앞소매 보조선(SP→앞둘레점)과 G수평선의 교점에서 소매산 방향 1cm 점
    // 3) 공통옆가슴점→G의 x길이 2/3 지점 vertical을 만들고, 앞둘레점 쪽에도 복사
    {
      const capH = sf.SCH();
      const frontDx = Math.sqrt(Math.max(0, fAH*fAH - capH*capH));
      const frontCircPt = { x: sx_C + frontDx, y: sy_base };

      // 1. G점 높이 수평선
      g.appendChild(Ln({x:SG.x, y:frontJoin.y}, {x:frontCircPt.x, y:frontJoin.y}, "sleeve-culture-aux-copy"));
      g.appendChild(lbl({x:frontCircPt.x, y:frontJoin.y}, "G높이", "sleeve-guide-label", 5, 3));

      // 2. 앞 보조선과 G수평선의 교점 → 소매산 방향 1cm
      const denomY = frontCircPt.y - SP.y || 1;
      const tMeet = Math.max(0, Math.min(1, (frontJoin.y - SP.y) / denomY));
      const meet = {
        x: SP.x + (frontCircPt.x - SP.x) * tMeet,
        y: SP.y + (frontCircPt.y - SP.y) * tMeet
      };
      const toSP = { x: SP.x - meet.x, y: SP.y - meet.y };
      const toSPLen = Math.hypot(toSP.x, toSP.y) || 1;
      const meetIn = { x: meet.x + toSP.x/toSPLen * 1, y: meet.y + toSP.y/toSPLen * 1 };
      sleevePatPts.frontGUp = meetIn;
      g.appendChild(Ln(meet, meetIn, "sleeve-culture-aux"));
      {
        const [mx,my] = c2p(meet.x, meet.y);
        const [ix,iy] = c2p(meetIn.x, meetIn.y);
        g.appendChild(E("circle",{cx:mx,cy:my,r:3,class:"sleeve-culture-aux-point"}));
        g.appendChild(E("circle",{cx:ix,cy:iy,r:3.6,class:"sleeve-culture-aux-point"}));
      }
      g.appendChild(lbl(meetIn, "G수평∩앞보조 +1", "txt-dark", 5, -5));

      // 3. SG→G x길이의 2/3 지점(aaa)에서 앞진동선까지 수직선
      const gXLen = frontJoin.x - SG.x;
      const aaaLen = gXLen * 2/3;
      const aaaX = SG.x + aaaLen;

      const cubicPoint = (p0,h1,h2,p1,t) => {
        const mt = 1 - t;
        return {
          x: mt*mt*mt*p0.x + 3*mt*mt*t*h1.x + 3*mt*t*t*h2.x + t*t*t*p1.x,
          y: mt*mt*mt*p0.y + 3*mt*mt*t*h1.y + 3*mt*t*t*h2.y + t*t*t*p1.y
        };
      };
      let hit = null;
      if(guide.lowerFrontArmhole){
        const lh = guide.lowerFrontArmhole;
        const h1 = toFrontFromSide(lh.h2b);
        const h2 = toFrontFromSide(lh.h3a);
        const a3 = toFrontFromSide(lh.a3);
        const h3 = toFrontFromSide(lh.h3b);
        const h4 = toFrontFromSide(lh.h4);
        const p2 = toFrontFromSide(lh.G);
        const samples = [];
        for(let i=0;i<=80;i++) samples.push(cubicPoint(SG,h1,h2,a3,i/80));
        for(let i=1;i<=80;i++) samples.push(cubicPoint(a3,h3,h4,p2,i/80));
        hit = samples.reduce((best,pt)=>{
          if(!best) return pt;
          return Math.abs(pt.x-aaaX) < Math.abs(best.x-aaaX) ? pt : best;
        }, null);
      }
      if(!hit) hit = { x: aaaX, y: SG.y + (frontJoin.y-SG.y)*2/3 };

      const aaaBase = { x: aaaX, y: sy_base };
      const aaaTop  = { x: aaaX, y: hit.y };
      g.appendChild(Ln(aaaBase, aaaTop, "sleeve-culture-aux"));
      {
        const [ax,ay] = c2p(aaaBase.x, aaaBase.y);
        g.appendChild(E("circle",{cx:ax,cy:ay,r:3,class:"sleeve-culture-aux-point"}));
      }
      g.appendChild(lbl(aaaBase, "aaa 2/3", "txt-dark", 5, 12));

      // 앞둘레점에서 aaa 길이만큼 공통옆가슴점 방향으로 이동한 곳에 수직선 복사
      const copyX = frontCircPt.x - Math.abs(aaaLen);
      const copyBase = { x: copyX, y: sy_base };
      const copyTop  = { x: copyX, y: sy_base - (sy_base - hit.y) };
      sleevePatPts.frontCopyTop = copyTop;
      g.appendChild(Ln(copyBase, copyTop, "sleeve-culture-aux-copy"));
      g.appendChild(lbl(copyBase, "aaa 복사", "sleeve-guide-label", 5, 12));
    }

    // ── 문화식 뒤소매 추가 보조선 ─────────────────
    // 기준 재정의:
    // 1) G높이 수평선과 뒤소매산선(SP→뒤둘레점)의 교점에서 1cm 아래 보조점
    // 2) 뒤암홀선보조선(복사된 뒤진동 곡선)과 G높이 수평선의 교점 = ccc
    // 3) SG→ccc x거리의 2/3 지점에서 수직선을 올려 뒤암홀선보조선과 만나는 선 표시
    // 4) 그 수직선을 뒤둘레점에서 2/3만큼 들어온 위치에 복사
    {
      const yG = frontJoin.y;

      // 뒤소매산선 = 소매산점(SP) → 뒤둘레점(sleeveBackCircPt)
      const backSleeveCapEnd = sleeveBackCircPt || { x: sx_C - Math.abs(frontJoin.x-SG.x), y: sy_base };

      const pointOnSegmentByY = (a, b, targetY) => {
        const dy = b.y - a.y;
        const t = dy ? (targetY - a.y) / dy : 0;
        const tt = Math.max(0, Math.min(1, t));
        return {
          x: a.x + (b.x - a.x) * tt,
          y: a.y + (b.y - a.y) * tt
        };
      };

      const closestSampleByY = (samples, targetY) => {
        if(!samples || !samples.length) return null;
        return samples.reduce((best, pt) => {
          if(!best) return pt;
          return Math.abs(pt.y - targetY) < Math.abs(best.y - targetY) ? pt : best;
        }, null);
      };

      const closestSampleByX = (samples, targetX) => {
        if(!samples || !samples.length) return null;
        return samples.reduce((best, pt) => {
          if(!best) return pt;
          return Math.abs(pt.x - targetX) < Math.abs(best.x - targetX) ? pt : best;
        }, null);
      };

      // 1. G높이 수평선과 뒤소매산선의 교점 → 아래 1cm 보조점
      const backCapMeet = pointOnSegmentByY(SP, backSleeveCapEnd, yG);
      g.appendChild(Ln({x:backCapMeet.x, y:yG}, {x:SG.x, y:yG}, "sleeve-culture-aux-copy"));
      g.appendChild(dot(backCapMeet, "pt-main", 3));
      g.appendChild(lbl(backCapMeet, "뒤소매산∩G높이", "txt-dark", -72, -5));

      // 뒤소매산선 위에서 뒤둘레점 방향으로 1cm 이동한 보조점
      const backCapDir = { x: backSleeveCapEnd.x - backCapMeet.x, y: backSleeveCapEnd.y - backCapMeet.y };
      const backCapDirLen = Math.hypot(backCapDir.x, backCapDir.y) || 1;
      const backCapDown = {
        x: backCapMeet.x + backCapDir.x / backCapDirLen * 1,
        y: backCapMeet.y + backCapDir.y / backCapDirLen * 1
      };
      sleevePatPts.backOneDown = backCapDown;
      g.appendChild(Ln(backCapMeet, backCapDown, "sleeve-culture-aux"));
      {
        const [dx,dy] = c2p(backCapDown.x, backCapDown.y);
        g.appendChild(E("circle",{cx:dx,cy:dy,r:3.6,class:"sleeve-culture-aux-point"}));
      }
      g.appendChild(lbl(backCapDown, "아래 1", "txt-dark", -42, 10));

      // 2. 뒤암홀선보조선과 G높이 수평선의 교점 = ccc
      const ccc = closestSampleByY(sleeveBackCurveSamples, yG) || backCapMeet;
      g.appendChild(dot(ccc, "pt-main", 3));
      g.appendChild(lbl(ccc, "ccc", "txt-dark", -22, -6));
      g.appendChild(Ln({x:ccc.x, y:yG}, {x:SG.x, y:yG}, "sleeve-culture-aux-copy"));

      // 3. SG→ccc x축 거리의 2/3 지점에서 수직선을 올려 뒤암홀선보조선과 만나는 선
      const cccXLen = ccc.x - SG.x; // 뒤쪽이므로 보통 음수
      const cccTwoThird = cccXLen * 2/3;
      const bbbX = SG.x + cccTwoThird;
      const hit = closestSampleByX(sleeveBackCurveSamples, bbbX) || pointOnSegmentByY(SP, backSleeveCapEnd, yG);

      const bbbBase = { x: bbbX, y: sy_base };
      const bbbTop  = { x: bbbX, y: hit.y };
      g.appendChild(Ln(bbbBase, bbbTop, "sleeve-culture-aux"));
      g.appendChild(dot(bbbTop, "pt-dep", 3));
      g.appendChild(lbl(bbbBase, "ccc 2/3", "txt-dark", -45, 12));

      // 4. 뒤둘레점에서 2/3 길이만큼 공통옆가슴점 방향으로 이동한 위치에 복사
      if(sleeveBackCircPt){
        const copyX = sleeveBackCircPt.x + Math.abs(cccTwoThird);
        const copyBase = { x: copyX, y: sy_base };
        const copyTop  = { x: copyX, y: sy_base - (sy_base - hit.y) };
        sleevePatPts.backCopyTop = copyTop;
        g.appendChild(Ln(copyBase, copyTop, "sleeve-culture-aux-copy"));
        g.appendChild(lbl(copyBase, "ccc 복사", "sleeve-guide-label", -45, 12));
      }
    }
  }


  // ── 실제 소매 패턴선: 뒤둘레점 → 보조점들 → 소매산 → 보조점들 → 앞둘레점 ──
  // 소매산 편집모드에서는 암홀처럼 베지어 핸들을 직접 드래그할 수 있고, 저장 데이터에도 포함된다.
  {
    const rawAnchors = [
      sleevePatPts.backCircPt,     // 1. 뒤둘레점
      sleevePatPts.backCopyTop,    // 2. 가까운 수직 복사점
      sleevePatPts.backOneDown,    // 3. 뒤소매산선 위 1cm점
      sleevePatPts.backQOut,       // 4. 소매산에서 직각 2cm점
      SP,                          // 5. 소매산 (고정 index=4)
      sleevePatPts.frontQOut,      // 6. 직각 1.9cm점
      sleevePatPts.frontGUp,       // 7. G점에서 소매산방향 1cm점
      sleevePatPts.frontCopyTop,   // 8. aaa 복사 직각끝점
      sleevePatPts.frontCircPt     // 9. 앞둘레점
    ];
    const anchorNames = ['backCircPt','backCopyTop','backOneDown','backQOut','SP','frontQOut','frontGUp','frontCopyTop','frontCircPt'];
    rawAnchors.forEach((pt, i) => {
      if(!pt) console.warn(`[sleeve] 앵커 누락: ${anchorNames[i]} (index ${i})`);
    });
    const anchors = rawAnchors.filter(Boolean);

    if(anchors.length >= 2){
      const pxy = pt => c2p(pt.x, pt.y);
      const clonePt = pt => ({x:+pt.x, y:+pt.y});
      const catCtrl = (p0,p1,p2,p3) => ({
        c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
        c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
      });
      const makeDefaultSleeveH = () => {
        const segs = [];
        for(let i=0;i<anchors.length-1;i++){
          const p0 = anchors[Math.max(0,i-1)];
          const p1 = anchors[i];
          const p2 = anchors[i+1];
          const p3 = anchors[Math.min(anchors.length-1,i+2)];
          const {c1,c2} = catCtrl(p0,p1,p2,p3);
          segs.push({c1:clonePt(c1), c2:clonePt(c2)});
        }
        // anchorOffsets: 각 앵커의 공식 위치에서 얼마나 이동했는지 저장
        const anchorOffsets = anchors.map(() => ({dx:0, dy:0}));
        return { anchorCount: anchors.length, segments: segs, anchorOffsets };
      };

      if(!state.sleeveH || state.sleeveH.anchorCount !== anchors.length || !state.sleeveH.segments || state.sleeveH.segments.length !== anchors.length-1){
        restoreSavedSleevePatternForAnchorCount(anchors.length);
      }
      if(!state.sleeveH || state.sleeveH.anchorCount !== anchors.length || !state.sleeveH.segments || state.sleeveH.segments.length !== anchors.length-1){
        state.sleeveH = makeDefaultSleeveH();
      }
      const SH = state.sleeveH;
      // anchorOffsets 없으면 초기화 (구버전 호환)
      if(!SH.anchorOffsets || SH.anchorOffsets.length !== anchors.length){
        SH.anchorOffsets = anchors.map(() => ({dx:0, dy:0}));
      }
      // 실제 앵커 위치 = 공식 위치 + 오프셋
      const actualAnchors = anchors.map((pt, i) => ({
        x: pt.x + SH.anchorOffsets[i].dx,
        y: pt.y + SH.anchorOffsets[i].dy
      }));

      let d = '';
      const [mx,my] = pxy(actualAnchors[0]);
      d = `M${mx},${my}`;
      // DXF 내보내기용: 소매산 베지어 세그먼트를 패턴 좌표(cm)로 저장
      const exportCapSegs = [];
      for(let i=0;i<actualAnchors.length-1;i++){
        const seg = SH.segments[i];
        const [c1x,c1y] = pxy(seg.c1);
        const [c2x,c2y] = pxy(seg.c2);
        const [x2,y2] = pxy(actualAnchors[i+1]);
        d += ` C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
        // 패턴 좌표 그대로 저장 (p0, c1, c2, p1)
        exportCapSegs.push({
          p0: {x: actualAnchors[i].x,   y: actualAnchors[i].y},
          c1: {x: seg.c1.x,             y: seg.c1.y},
          c2: {x: seg.c2.x,             y: seg.c2.y},
          p1: {x: actualAnchors[i+1].x, y: actualAnchors[i+1].y}
        });
      }
      g.appendChild(E("path",{d,class:"sleeve-pattern-line"}));
      // 소매산 곡선 좌표 저장
      if(!state.sleeveExport) state.sleeveExport = {};
      state.sleeveExport.capSegments = exportCapSegs;

      // ── 이세량 실시간 계산: 몸판 암홀 길이 vs 소매 패턴선 길이 ──
      const segLen = (i) => {
        const seg = SH.segments[i];
        return bezierLen([
          [actualAnchors[i].x, actualAnchors[i].y],
          [seg.c1.x, seg.c1.y],
          [seg.c2.x, seg.c2.y],
          [actualAnchors[i+1].x, actualAnchors[i+1].y]
        ], 80);
      };
      // SP 인덱스: rawAnchors 고정 인덱스 기준 (index 4 = SP)
      // anchors는 filter(Boolean) 결과이므로 null 제거 수만큼 인덱스가 달라질 수 있음
      // SP 앵커에 오프셋이 생겨도 이세량 분할 기준이 흔들리지 않도록 rawAnchors 기준으로 고정
      const spRawIndex = 4;
      const spIndex = rawAnchors.slice(0, spRawIndex + 1).filter(Boolean).length - 1;
      if(spIndex >= 0 && spIndex < actualAnchors.length-1){
        let sleeveBackLen = 0;
        for(let i=0;i<spIndex;i++) sleeveBackLen += segLen(i);
        let sleeveFrontLen = 0;
        for(let i=spIndex;i<actualAnchors.length-1;i++) sleeveFrontLen += segLen(i);
        const backEase = sleeveBackLen - bAH;
        const frontEase = sleeveFrontLen - fAH;
        const totalEase = backEase + frontEase;
        const panelX = sx_F + 7;
        const panelY = sy_SP + 4;
        // 이세량 패널: ease-info 클래스로 항상 표시 (편집모드 여부 무관)
        // font-size는 viewZ에 비례해서 줌 시 글씨도 같이 커짐
        const easeSign = v => v >= 0 ? "+" : "";
        const baseFontSize = 11 * viewZ;  // 줌 비례 폰트 크기
        const lineGap = 1.8;             // 줄 간격 (cm 단위)
        const rows = [
          { txt: `뒤암홀 ${bAH.toFixed(1)}   뒤소매 ${sleeveBackLen.toFixed(1)}   뒤이세 ${easeSign(backEase)}${backEase.toFixed(2)}`, color: backEase < 0 ? "#cc3333" : "#111" },
          { txt: `앞암홀 ${fAH.toFixed(1)}   앞소매 ${sleeveFrontLen.toFixed(1)}   앞이세 ${easeSign(frontEase)}${frontEase.toFixed(2)}`, color: frontEase < 0 ? "#cc3333" : "#111" },
          { txt: `총이세  ${easeSign(totalEase)}${totalEase.toFixed(2)} cm`, color: totalEase < 0 ? "#cc3333" : "#111" },
        ];
        rows.forEach(({txt, color}, idx)=>{
          const [tx,ty] = c2p(panelX, panelY + idx * lineGap);
          const t = E("text",{x:tx, y:ty, fill:color, "font-size":baseFontSize, "font-weight":"700", "font-family":"monospace", class:"ease-info"});
          t.textContent = txt;
          g.appendChild(t);
        });
      }

      const moveSleeveHandle = (segIndex, which, ev) => {
        ev.stopPropagation();
        const onMove = mv => {
          const [nx,ny] = eventToPatternPoint(mv);
          state.sleeveH.segments[segIndex][which].x = nx;
          state.sleeveH.segments[segIndex][which].y = ny;
          render();
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };

      // 앵커 드래그: 편집모드에서 앵커도 직접 이동 가능
      const moveSleeveAnchor = (anchorIdx, ev) => {
        ev.stopPropagation();
        const origPt = anchors[anchorIdx]; // 공식 기준점
        const origOffset = SH.anchorOffsets[anchorIdx];
        const startPt = eventToPatternPoint(ev);
        const startX = startPt[0], startY = startPt[1];
        const onMove = mv => {
          const [nx,ny] = eventToPatternPoint(mv);
          const dx = nx - startX, dy = ny - startY;
          // 오프셋 누적
          SH.anchorOffsets[anchorIdx] = {
            dx: origOffset.dx + dx,
            dy: origOffset.dy + dy
          };
          // 연결된 핸들도 같이 이동
          const newAnchor = { x: origPt.x + SH.anchorOffsets[anchorIdx].dx, y: origPt.y + SH.anchorOffsets[anchorIdx].dy };
          const prevAnchor = anchorIdx > 0 ? actualAnchors[anchorIdx-1] : null;
          const nextAnchor = anchorIdx < anchors.length-1 ? actualAnchors[anchorIdx+1] : null;
          if(anchorIdx > 0){
            const seg = SH.segments[anchorIdx-1];
            seg.c2.x += dx; seg.c2.y += dy;
          }
          if(anchorIdx < anchors.length-1){
            const seg = SH.segments[anchorIdx];
            seg.c1.x += dx; seg.c1.y += dy;
          }
          render();
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };

      // 핸들 표시: 시작/끝은 하나, 중간점은 양쪽 핸들.
      SH.segments.forEach((seg,i)=>{
        const from = actualAnchors[i];
        const to   = actualAnchors[i+1];
        const [x1,y1] = pxy(from), [x2,y2] = pxy(to);
        const [c1x,c1y] = pxy(seg.c1), [c2x,c2y] = pxy(seg.c2);
        g.appendChild(E("line",{x1,y1,x2:c1x,y2:c1y,class:"sleeve-pattern-handle"}));
        g.appendChild(E("line",{x1:x2,y1:y2,x2:c2x,y2:c2y,class:"sleeve-pattern-handle"}));

        const h1 = E("circle",{cx:c1x,cy:c1y,r:state.sleeveEditMode?5:2.7,class:"sleeve-pattern-handle-pt",style:state.sleeveEditMode?"cursor:grab":""});
        const h2 = E("circle",{cx:c2x,cy:c2y,r:state.sleeveEditMode?5:2.7,class:"sleeve-pattern-handle-pt",style:state.sleeveEditMode?"cursor:grab":""});
        if(state.sleeveEditMode){
          h1.addEventListener("mousedown", ev => moveSleeveHandle(i, "c1", ev));
          h2.addEventListener("mousedown", ev => moveSleeveHandle(i, "c2", ev));
        }
        g.appendChild(h1);
        g.appendChild(h2);
      });

      actualAnchors.forEach((pt,idx)=>{
        const [ax,ay]=pxy(pt);
        const hasOffset = SH.anchorOffsets[idx] && (Math.abs(SH.anchorOffsets[idx].dx) > 0.001 || Math.abs(SH.anchorOffsets[idx].dy) > 0.001);
        // 편집모드: 앵커 크게 + 드래그 가능 / 오프셋 있는 앵커는 색상 강조
        const anchorR = state.sleeveEditMode ? 7 : 3.2;
        const anchorFill = state.sleeveEditMode ? (hasOffset ? "#e07800" : "#185FA5") : "#111";
        const a = E("circle",{cx:ax,cy:ay,r:anchorR,fill:anchorFill,stroke:"white","stroke-width":1.5,class:"sleeve-pattern-anchor",style:state.sleeveEditMode?"cursor:grab":""});
        if(state.sleeveEditMode){
          a.addEventListener("mousedown", ev => moveSleeveAnchor(idx, ev));
        }
        g.appendChild(a);
        if(idx===0) g.appendChild(lbl(pt,"뒤둘레 시작","txt-dark",-44,-8));
        if(idx===actualAnchors.length-1) g.appendChild(lbl(pt,"앞둘레 끝","txt-dark",5,-8));
      });
      g.appendChild(lbl(SP,state.sleeveEditMode?"소매산 편집중":"실제 소매산 패턴선","txt-dark",8,-18));
    }
  }


  // ── 소매단 수정 기능: 앞둘레점-뒤둘레점의 중간을 중심으로 소매단둘레/2씩 이동 ──
  // 기준: 소매단 중심은 소매산 중심선이 아니라, 앞둘레점과 뒤둘레점의 중간점에서 수직 하강한 지점이다.
  if(sleevePatPts.backCircPt && sleevePatPts.frontCircPt){
    // 소매단 기준: sx_C 중심으로 뒤/앞 둘레점 비율에 따라 hemCirc 배분
    // backDx/frontDx 비율로 좌우를 나누어 소매단둘레 입력값을 유지하면서 비대칭 보정
    const _backDx  = sx_C - sleevePatPts.backCircPt.x;
    const _frontDx = sleevePatPts.frontCircPt.x - sx_C;
    const _totalDx = _backDx + _frontDx;
    const backHemHalf  = _totalDx > 0 ? hemHalf * (_backDx  / _totalDx) * 2 : hemHalf;
    const frontHemHalf = _totalDx > 0 ? hemHalf * (_frontDx / _totalDx) * 2 : hemHalf;
    const hemCenter  = { x: sx_C,                  y: sy_HEM };
    const backHemPt  = { x: sx_C - backHemHalf,    y: sy_HEM };
    const frontHemPt = { x: sx_C + frontHemHalf,   y: sy_HEM };

    // 뒤/앞 옆선: 둘레점에서 조절된 소매단으로 연결
    g.appendChild(Ln(sleevePatPts.backCircPt,  backHemPt,  "sleeve-pattern-line"));
    g.appendChild(Ln(sleevePatPts.frontCircPt, frontHemPt, "sleeve-pattern-line"));

    // 조절된 소매단선
    g.appendChild(Ln(backHemPt, frontHemPt, "sleeve-pattern-line"));

    // DXF 내보내기용: 소매 옆선·소매단 좌표 저장 (패턴 좌표 cm)
    if(!state.sleeveExport) state.sleeveExport = {};
    state.sleeveExport.sideLines = [
      { a: {x:sleevePatPts.backCircPt.x,  y:sleevePatPts.backCircPt.y},  b: {x:backHemPt.x,  y:backHemPt.y}  },
      { a: {x:sleevePatPts.frontCircPt.x, y:sleevePatPts.frontCircPt.y}, b: {x:frontHemPt.x, y:frontHemPt.y} },
      { a: {x:backHemPt.x, y:backHemPt.y}, b: {x:frontHemPt.x, y:frontHemPt.y} }
    ];
    // 소매 배치 기준점도 저장 (DXF에서 원점 정렬용)
    state.sleeveExport.bounds = { sx_C, sy_SP, sy_HEM };

    // 소매단 중심선 보조선: 소매산점(SP)에서 소매단까지 수직으로 내려오는 중심선
    const hemCenterTop = { x: sx_C, y: sy_SP };
    const hemCenterLine = E("line", {
      x1: c2p(hemCenterTop.x, hemCenterTop.y)[0], y1: c2p(hemCenterTop.x, hemCenterTop.y)[1],
      x2: c2p(hemCenter.x,    hemCenter.y   )[0], y2: c2p(hemCenter.x,    hemCenter.y   )[1],
      class: "sleeve-culture", "stroke-dasharray": "4,3"
    });
    g.appendChild(hemCenterLine);

    // 소매단 중심 및 기준 표시
    g.appendChild(dot(backHemPt,  "pt-main", 3.2));
    g.appendChild(dot(frontHemPt, "pt-main", 3.2));
    g.appendChild(dot(hemCenter,  "pt-dep", 3));
    g.appendChild(lbl(backHemPt,  `뒤소매단`, "txt-dark", -48, 12));
    g.appendChild(lbl(frontHemPt, `앞소매단`, "txt-dark", 5, 12));
    g.appendChild(lbl(hemCenter,  `소매단 중심 / 단둘레 ${hemCirc.toFixed(1)}`, "txt-dep", -52, 14));
  }

  const SB = {x:sx_B, y:sy_base};
  const SF = {x:sx_F, y:sy_base};
  g.appendChild(dot(SB,"pt-dep",3));
  g.appendChild(dot(SF,"pt-dep",3));

  g.appendChild(dimLine(SB, SG, -10));
  {
    const[x,y]=c2p((sx_B+sx_C)/2, sy_base-1.5);
    const t=E("text",{x,y,fill:"#185FA5","font-size":8,"text-anchor":"middle","font-weight":"700"});
    t.textContent=`뒤AH=${bAH.toFixed(1)}`;
    g.appendChild(t);
  }

  g.appendChild(dimLine(SG, SF, -10));
  {
    const[x,y]=c2p((sx_C+sx_F)/2, sy_base-1.5);
    const t=E("text",{x,y,fill:"#0F6E56","font-size":8,"text-anchor":"middle","font-weight":"700"});
    t.textContent=`앞AH=${fAH.toFixed(1)}`;
    g.appendChild(t);
  }

  g.appendChild(dimLine(SP, SG, 8));

  // 사용성 정리: 종속선 OFF면 보조선 숨기고, ON이면 G높이선과 함께 보여준다.
  if(!showDep){
    Array.from(g.querySelectorAll('.sleeve-culture-aux,.sleeve-culture-aux-copy,.sleeve-culture-aux-point')).forEach(el=>el.remove());
  }
  if(sleevePatPts.gY !== undefined && sleevePatPts.frontCircPt && sleevePatPts.backCircPt){
    g.appendChild(Ln({x:sleevePatPts.backCircPt.x,y:sleevePatPts.gY},{x:sleevePatPts.frontCircPt.x,y:sleevePatPts.gY},"dep"));
    g.appendChild(lbl({x:sleevePatPts.frontCircPt.x,y:sleevePatPts.gY},"G높이","sleeve-guide-label",5,3));
  }

  // ── 표시옵션 통합 ────────────────────────────────
  // 패턴선 옵션
  if(!showPattern){
    g.querySelectorAll('.sleeve-pattern-line,.sleeve-pattern-handle,.sleeve-pattern-handle-pt,.sleeve-pattern-anchor').forEach(el=>el.remove());
  } else if(!state.sleeveEditMode){
    g.querySelectorAll('.sleeve-pattern-handle,.sleeve-pattern-handle-pt,.sleeve-pattern-anchor').forEach(el=>el.remove());
    g.querySelectorAll('text').forEach(el=>{
      const txt = el.textContent || '';
      // ease-info(이세량 패널)와 소매단 치수 라벨은 항상 표시
      if(el.classList.contains('ease-info')) return;
      if(/실제 소매산|소매산 편집중|뒤둘레 시작|앞둘레 끝|뒤소매단|앞소매단/.test(txt)) el.remove();
      if(/소매단 중심/.test(txt) && !/단둘레/.test(txt)) el.remove();
    });
    g.querySelectorAll('.pt-main,.pt-dep').forEach(el=>el.remove());
  }

  // 종속선 옵션: OFF면 모든 보조선 숨김, ON이면 최대한 많이 표시
  if(!showDep){
    g.querySelectorAll([
      '.sleeve-front-guide','.sleeve-back-guide',
      '.sleeve-sch-culture','.sleeve-sch-reco',
      '.sleeve-front-circ','.sleeve-front-circ-light',
      '.sleeve-back-circ','.sleeve-back-circ-light',
      '.sleeve-culture-aux','.sleeve-culture-aux-copy','.sleeve-culture-aux-point',
      '.dep','.rBL','.rWL',
      '.pt-dep','.txt-dep','.sleeve-guide-label'
    ].join(',')).forEach(el=>el.remove());
  }
  // 종속선 ON이면: 보조선 라벨/점 모두 표시 (안내점 체크박스와 무관하게)

  // 안내점 옵션: OFF면 보조점/라벨 숨김 (단, 종속선 ON이면 유지)
  if(window.__showGuide !== true && !showDep){
    g.querySelectorAll('.pt-main,.pt-dep,.sleeve-culture-aux-point,.sleeve-pattern-anchor').forEach(el=>el.remove());
    g.querySelectorAll('text').forEach(el=>{
      const fill = el.getAttribute('fill') || '';
      const txt = (el.textContent || '').trim();
      const isDimOrEase = fill === '#e07800' || /^(뒤암홀|앞암홀|총이세|뒤이세|앞이세)/.test(txt);
      // 소매단 중심 라벨 중 '단둘레' 숫자가 포함된 것은 치수 정보이므로 항상 유지
      const isGuideText = /^(G높이|BL교점|앞진동|뒤진동|EL|SL|소매산|소매BL|뒤둘레 시작|앞둘레 끝|실제 소매산 패턴선)/.test(txt)
        || (/소매단 중심/.test(txt) && !/단둘레/.test(txt));
      if(!isDimOrEase || isGuideText) el.remove();
    });
  }

  // 기초선 옵션
  if(!showBase){
    g.querySelectorAll('.base').forEach(el=>el.remove());
  }

  // 치수선 옵션
  if(!showDim){
    g.querySelectorAll('.dim,.sleeve-guide-label').forEach(el=>el.remove());
    g.querySelectorAll('text').forEach(el=>{
      const fill = el.getAttribute('fill') || '';
      const txt = el.textContent || '';
      if(fill === '#e07800' || /^(EL|SL|뒤AH|앞AH|BL교점|앞진동|뒤진동|총이세|앞암홀|뒤암홀)/.test(txt)) el.remove();
    });
  }

  svg.appendChild(g);
}

function updateStatusBar(f,p,dr,B,W,BL){
  const fSNP_x  = f.sw() - (B/24+3.4);
  const armX    = f.sw() - f.fw();
  const fShLen  = (fSNP_x - armX) / Math.cos(22 * Math.PI / 180) + 1.8;
  const bShReal = fShLen;
  const { bAH, fAH } = calcArmholeLengths(f,p,B);

  const capInfo = getSelectedSleeveCapHeight(f,p,B,bAH,fAH);
  const capAdj = capInfo.capAdj;
  const baseCapHeight = capInfo.base;
  const finalCapHeight = capInfo.final;
  const backTargetInfo = calcBackSleeveTargetLength(B, bAH);
  document.getElementById("sb").textContent=
    `B=${B} W=${W} BL=${BL} | 앞어깨=${fShLen.toFixed(2)}cm 뒤어깨=${bShReal.toFixed(2)}cm | 뒤진동=${bAH.toFixed(2)}cm 앞진동=${fAH.toFixed(2)}cm 합계=${(bAH+fAH).toFixed(2)}cm | 뒤소매목표=뒤진동+1+α(${backTargetInfo.alpha.toFixed(1)})=${backTargetInfo.target.toFixed(2)}cm | 소매산 문화식=${capInfo.culture.toFixed(2)} 추천식=${capInfo.recommended.toFixed(2)} 적용(${capInfo.mode==="culture"?"문화식":"추천식"})=${baseCapHeight.toFixed(2)}${capAdj>=0?"+":""}${capAdj.toFixed(1)}=${finalCapHeight.toFixed(2)}cm | 다트총량=${dr.total.toFixed(2)} a=${dr.a.toFixed(2)} b=${dr.b.toFixed(2)} c=${dr.c.toFixed(2)} d=${dr.d.toFixed(2)} e=${dr.e.toFixed(2)} f=${dr.f.toFixed(2)}`;
}


