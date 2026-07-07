// ── 렌더 ──────────────────────────────────────
function render(){
  const W_=svg.clientWidth||900, H_=svg.clientHeight||700;
  svg.innerHTML="";

  // 격자: 치수를 입력하기 전에도 빈 작업장처럼 항상 표시
  const gg=E("g");
  const step=SC*viewZ;
  for(let x=0;x<W_;x+=step)gg.appendChild(line(x,0,x,H_,"grid-m"));
  for(let y=0;y<H_;y+=step)gg.appendChild(line(0,y,W_,y,"grid-m"));
  for(let x=0;x<W_;x+=step*5)gg.appendChild(line(x,0,x,H_,"grid-M"));
  for(let y=0;y<H_;y+=step*5)gg.appendChild(line(0,y,W_,y,"grid-M"));
  svg.appendChild(gg);

  const B=n("inpB"), W=n("inpW"), BL=n("inpBL");
  if(!B||!W||!BL){
    const capAdjVal = document.getElementById("capAdjVal");
    if(capAdjVal) capAdjVal.textContent = n("inpCapAdj").toFixed(1);
    const sb = document.getElementById("sb");
    if(sb) sb.textContent = "치수를 입력하면 패턴이 생성됩니다.";
    return;
  }

  const bodyMeasureKey = getBodyMeasureKey();
  const sleeveMeasureKey = getSleeveMeasureKey();
  if(lastBodyMeasureKey && lastBodyMeasureKey !== bodyMeasureKey){
    resetCurveHandles();
    loadSavedCurveForCurrentMeasurements(false);
  } else if(!state.sleeveEditMode && lastSleeveMeasureKey && lastSleeveMeasureKey !== sleeveMeasureKey){
    // 소매산 편집 중에는 소매 핸들을 리셋하지 않는다
    resetSleeveCurveHandles();
    restoreSavedSleevePatternForCurrentSleeve(false);
  }
  lastBodyMeasureKey = bodyMeasureKey;
  lastSleeveMeasureKey = sleeveMeasureKey;

  const d=createDraft(B,W,BL);
  const{formula:f, pts:p, darts:dr}=d;

  // 핸들이 없으면 초기화 (패턴 생성 버튼 없이 바로 치수 입력한 경우)
  initHandles(f, p, B);


  // 기준선
  const gRef=E("g");
  gRef.appendChild(Ln({x:0,y:f.yBL()},{x:f.sw(),y:f.yBL()},"rBL"));
  gRef.appendChild(Ln({x:0,y:f.yWL()},{x:f.sw(),y:f.yWL()},"rWL"));
  // 레이블
  {const[,py]=c2p(0,f.yBL());gRef.appendChild(E("text",{x:70,y:py+4,"font-size":9,fill:"#a0c4e8","text-anchor":"end"},"BL"));}
  {const[,py]=c2p(0,f.yWL());gRef.appendChild(E("text",{x:70,y:py+4,"font-size":9,fill:"#f0a888","text-anchor":"end"},"WL"));}
  svg.appendChild(gRef);

  // ── 체크박스 상태 (한 번만 읽기) ─────────────
  const showBase    = document.getElementById("chkBase")?.checked    !== false;
  const showDart    = document.getElementById("chkDartWaist")?.checked !== false;
  const showDep     = document.getElementById("chkDep")?.checked     === true;
  const showPattern = document.getElementById("chkPattern")?.checked !== false;
  const showGuide   = document.getElementById("chkGuide")?.checked   === true;
  window.__showGuide = showGuide;
  const showDim     = document.getElementById("chkDim")?.checked     === true;

  // ── 다트 미리 계산 ───────────────────────────
  const WL_y = f.yWL();
  const darts_ = {
    a: makeDart(dr.a, {x:p.BP.x,        y:p.BP.y+2      }, WL_y),
    b: makeDart(dr.b, {x:p.F.x+1.5,     y:p.G.y         }, WL_y),
    c: makeDart(dr.c, {x:p.SIDE_TOP.x,  y:p.SIDE_TOP.y  }, WL_y),
    d: makeDart(dr.d, {x:p.C.x-1,       y:p.G.y         }, WL_y),
    e: makeDart(dr.e, {x:p.E.x-0.5,     y:f.yBL()-2     }, WL_y),
    f: makeDart(dr.f, {x:0, y:f.yBL()-(f.yBL()-f.yD())*2/3}, WL_y),
  };

  const showBody = state.workMode !== "sleeve";
  const showSleeve = state.workMode !== "body";
  if(showBody){
    drawBaseLines(svg,f,p,dr,B,W,BL,showBase,showDart,showDep,showPattern,showDim);
    drawDepLines(svg,f,p,dr,B,W,BL,showBase,showDart,showDep,showPattern,showDim);
    drawPatternLines(svg,f,p,dr,darts_,B,W,BL,showBase,showDart,showDep,showPattern,showDim);
    drawDarts(svg,f,p,dr,darts_,B,W,BL,showBase,showDart,showDep,showPattern,showDim);
    drawDimLines(svg,f,p,dr,darts_,B,W,BL,showBase,showDart,showDep,showPattern,showDim);
    drawPoints(svg,f,p,dr,darts_,B,W,BL,showBase,showDart,showDep,showPattern,showDim);
  }
  // isMeasureDirty: 치수 변경 후 패턴 생성 버튼을 아직 안 눌렀으면 소매 패턴 그리지 않음
  if(showSleeve && !isMeasureDirty) drawSleeve(svg,f,p,dr,B,W,BL,showBase,showDart,showDep,showPattern,showDim);
  if(typeof drawDartMoveOverlay === 'function') drawDartMoveOverlay(svg, p);
  applyLayerVisibility();
  updateStatusBar(f,p,dr,B,W,BL);
}

// ══ DEBUG: 앞판/뒤판 색상 구분 (확인 후 제거) ══════════════
// DEBUG_COLORS = true  → 앞판 빨강 / 뒤판 파랑
// DEBUG_COLORS = false → 모두 기존 "pattern" 클래스 (검정)
const DEBUG_COLORS = true; // DEBUG
const DBG_FRONT = "#cc2222"; // DEBUG front
const DBG_BACK  = "#0066cc"; // DEBUG back
// LnC: 디버그 색상을 직접 주입하는 헬퍼
function LnC(a, b, cls, color){
  const el = Ln(a, b, cls);
  if(DEBUG_COLORS && color) el.setAttribute("style", `stroke:${color};`);
  return el;
}
// ════════════════════════════════════════════════════════════

function drawBaseLines(svg,f,p,dr,B,W,BL,showBase,showDart,showDep,showPattern,showDim){
  // ── 기초선 ①~⑭ ─────────────────────────────
  const g=E("g");
  g.setAttribute("id","layer-base");
  g.appendChild(Ln(p.A,      p.BACK_WL,  "base")); // ① 뒤중심
  g.appendChild(Ln(p.BACK_WL,p.FRONT_WL, "base")); // ② WL
  g.appendChild(Ln(p.B,      p.FRONT_WL, "base")); // ④ 앞중심
  g.appendChild(Ln({x:f.bw(),y:0},p.C,   "base")); // ⑥ 배폭선
  g.appendChild(Ln(p.A,{x:f.bw(),y:0},   "base")); // ⑦ A 수평선
  g.appendChild(Ln({x:0,y:f.yD()},p.D,   "base")); // ⑧ 8cm 수평선
  g.appendChild(Ln(p.FRONT_TL,p.B,        "base")); // ⑩ B점 수평선
  g.appendChild(Ln(p.FRONT_TL,p.FRONT_ARM,"base")); // ⑫ 앞품 수직선
  // ③ BL선 (base)
  g.appendChild(Ln({x:0,y:f.yBL()},{x:f.sw(),y:f.yBL()},"base"));
  // ⑬ G→F 수직, G→배폭선 수평
  g.appendChild(Ln(p.G,p.F,              "base")); // G→F 수직
  g.appendChild(Ln(p.G,{x:f.bw(),y:f.yG()},"base")); // G→배폭선 수평
  // ⑭ 옆선
  g.appendChild(Ln(p.SIDE_TOP,p.SIDE_BTM,"base"));
  if(showBase)svg.appendChild(g);

}

function drawDepLines(svg,f,p,dr,B,W,BL,showBase,showDart,showDep,showPattern,showDim){
  // ── 종속선 ───────────────────────────────────
  if(showDep){
    const dep=E("g");
    dep.appendChild(Ln(p.C,p.F,"dep"));
    dep.appendChild(lbl({x:(p.C.x+p.F.x)/2,y:p.C.y},"C-F → ⑭옆선","txt-dep",0,14));
    dep.appendChild(Ln(p.D,p.E,"dep"));
    dep.appendChild(lbl({x:(p.D.x+p.E.x)/2,y:p.D.y},"E=뒤품/2+1","txt-dep",0,-10));
    dep.appendChild(Ln(p.F,p.G,"dep"));
    dep.appendChild(lbl({x:p.F.x,y:(p.F.y+p.G.y)/2},"G depends F.x","txt-dep",6,0));
    svg.appendChild(dep);
  }

}

function drawPatternLines(svg,f,p,dr,darts_,B,W,BL,showBase,showDart,showDep,showPattern,showDim){
  if(!showPattern) return;
  const gPat=E("g");

  // ── 공통 변수 계산 ───────────────────────────
  const circ = f.fnw(), fnd = f.fnd();
  const nTR = { x: f.sw(),      y: f.yB()     };
  const nTL = { x: f.sw()-circ, y: f.yB()     };
  const nBR = { x: f.sw(),      y: f.yB()+fnd };
  const nBL = { x: f.sw()-circ, y: f.yB()+fnd };
  const deg22 = 22 * Math.PI / 180;
  const shLen_ = (nTL.x-(f.sw()-f.fw())) / Math.cos(deg22);
  const FSP = {
    x: nTL.x - (shLen_+1.8)*Math.cos(deg22),
    y: nTL.y + (shLen_+1.8)*Math.sin(deg22)
  };
  const vx_=p.BP.x-p.G.x, vy_=p.BP.y-p.G.y;
  const len_=Math.hypot(vx_,vy_);
  const ux_=-vx_/len_, uy_=-vy_/len_;
  const da_=(B/4-2.5)*Math.PI/180;
  const GG = {
    x: p.BP.x+(ux_*Math.cos(da_)-uy_*Math.sin(da_))*len_,
    y: p.BP.y+(ux_*Math.sin(da_)+uy_*Math.cos(da_))*len_
  };
  // ── 뒤판 공통변수 ──────────────────────────
  const deg18 = 18 * Math.PI / 180;
  const bSNP  = { x: f.bnw(), y: 0        };
  const bND   = { x: f.bnw(), y: -f.bnd() };
  const _fSNP_x2 = f.sw() - f.fnw();
  const _armX2   = f.sw() - f.fw();
  const _fShLen2 = (_fSNP_x2 - _armX2) / Math.cos(deg22) + 1.8;
  const _bShLen2 = _fShLen2 + B/32 - 0.8;
  const bSP = {
    x: bND.x + _bShLen2 * Math.cos(deg18),
    y: bND.y + _bShLen2 * Math.sin(deg18)
  };
  const shDx=Math.cos(deg18), shDy=Math.sin(deg18);
  const t_=(p.E.x-bND.x)/shDx;
  const dartCenterT=t_+1.5;
  const dartCenter={ x:bND.x+dartCenterT*shDx, y:bND.y+dartCenterT*shDy };
  const dartLen_=B/32-0.8;
  const dartEnd_={ x:dartCenter.x+dartLen_*shDx, y:dartCenter.y+dartLen_*shDy };
  const eOnSh={ x:bND.x+t_*shDx, y:bND.y+t_*shDy };

  const segLen  = (p.F.x - p.SIDE_TOP.x) / 3 + 0.5;
  const segLen2 = (p.F.x - p.SIDE_TOP.x) / 3 + 0.8;
  const fAux = {
    x: p.F.x - segLen  * Math.cos(45 * Math.PI / 180),
    y: p.F.y - segLen  * Math.sin(45 * Math.PI / 180)
  };
  const cAux = {
    x: p.C.x + segLen2 * Math.cos(45 * Math.PI / 180),
    y: p.C.y - segLen2 * Math.sin(45 * Math.PI / 180)
  };

  const cv = {nTR,nTL,nBR,nBL,deg22,FSP,GG,deg18,bSNP,bND,bSP,shDx,shDy,dartCenter,dartEnd_,eOnSh,fAux,cAux};

  drawFrontNeck(svg,f,p,dr,B,W,BL,showPattern,showDep,showDim,gPat,cv);
  drawFrontArmhole(svg,f,p,dr,B,W,BL,showPattern,showDep,gPat,cv);
  drawBackNeck(svg,f,p,dr,B,W,BL,showPattern,showDep,gPat,cv);
  drawBackShoulder(svg,f,p,dr,B,W,BL,showPattern,showDep,showDim,gPat,cv);
  drawArmhole(svg,f,p,dr,darts_,B,W,BL,showPattern,showDep,gPat,cv);

  // 표시옵션 정리: 패턴선은 완성 외곽선만 남긴다.
  // 종속선/치수/편집 핸들은 각 옵션 또는 편집모드에서만 보이게 한다.
  if(!showDep){
    gPat.querySelectorAll('.dep,.pt-dep,.txt-dep').forEach(el=>el.remove());
  }
  if(!showDim){
    gPat.querySelectorAll('.dim').forEach(el=>el.remove());
    gPat.querySelectorAll('text').forEach(el=>{
      const fill = el.getAttribute('fill') || '';
      const txt = el.textContent || '';
      if(fill === '#e07800' || /^(\d+\.\d+)$/.test(txt)) el.remove();
    });
  }
  // 안내점 옵션: FSP/GG/G/F/BSP/SNP/BND/다트시작/다트끝/안내점 같은 점·라벨은 별도 옵션에서만 보인다.
  if(window.__showGuide !== true){
    gPat.querySelectorAll('.pt-main,.pt-dep').forEach(el=>el.remove());
    gPat.querySelectorAll('text').forEach(el=>{
      const fill = el.getAttribute('fill') || '';
      const txt = (el.textContent || '').trim();
      const isDimText = fill === '#e07800' || /^-?\d+(\.\d+)?$/.test(txt);
      const isGuideText = /^(FSP|GG|G|F|BSP|SNP|BND|BP|다트시작|다트끝|안내점|A|B|C|D|E)$/.test(txt);
      if(!isDimText || isGuideText) el.remove();
    });
  }
  // 편집 모드가 아닐 때는 핸들과 핸들 연결선을 숨긴다.
  if(!state.armEditMode && !state.neckEditMode){
    gPat.querySelectorAll('circle[style*="cursor:grab"],circle[style*="cursor: grab"]').forEach(el=>el.remove());
    gPat.querySelectorAll('line').forEach(el=>{
      const sw = String(el.getAttribute('strokeWidth') || el.getAttribute('stroke-width') || '');
      const dash = el.getAttribute('strokeDasharray') || el.getAttribute('stroke-dasharray') || '';
      if(dash === '3,2' && (sw === '0.8' || sw === '.8')) el.remove();
    });
  }
  svg.appendChild(gPat);

  // ── 다트이동 적용 결과: 앞판/뒤판 패턴선 대체 ──
  const hasDartMoveApplied = typeof dartMoveState !== 'undefined'
    && (dartMoveState.appliedFront != null || dartMoveState.appliedBack != null);
  if(hasDartMoveApplied){
    drawDartMoveApplied(svg, p, f, B);
  }
}

function drawPolylineFromPts(g, pts, cls = "pattern", color = null) {
  if (!pts || pts.length < 2) return;
  for (let i = 0; i < pts.length - 1; i++) {
    g.appendChild(LnC(pts[i], pts[i + 1], cls, color));
  }
}

function drawAppliedSegments(g, segs, cls, color, side) {
  if (!Array.isArray(segs)) return;
  // 블랙리스트: dart-bridge(조립용 내부 연결선)만 제외한다. dart-leg-new/dart-leg-old/
  // old-dart/back-shoulder-dart는 현재 baked 결과에 남아있는 실제 패턴선이므로
  // 일반 외곽선과 동일하게 그린다 — "지금 붙어있는 조각이 곧 현재 패턴"이다.
  const DART_SKIP = new Set(["dart-bridge"]);

  // 샘플링된 점들을 Catmull-Rom smooth path로 그릴 곡선 타입
  const CURVE_TYPES = new Set([
    "back-armhole", "front-armhole-lower", "front-armhole-upper",
    "back-neckline", "front-neckline",
  ]);

  const flushSmoothPath = (pts) => {
    if (pts.length < 2) return;
    const sc = pts.map(pt => { const [x,y] = c2p(pt.x, pt.y); return {x, y}; });
    let d = `M${sc[0].x},${sc[0].y}`;
    if (sc.length === 2) {
      d += ` L${sc[1].x},${sc[1].y}`;
    } else {
      for (let i = 0; i < sc.length - 1; i++) {
        const p0 = sc[Math.max(i - 1, 0)];
        const p1 = sc[i];
        const p2 = sc[i + 1];
        const p3 = sc[Math.min(i + 2, sc.length - 1)];
        const alpha = 0.5;
        const cp1x = p1.x + (p2.x - p0.x) * alpha / 3;
        const cp1y = p1.y + (p2.y - p0.y) * alpha / 3;
        const cp2x = p2.x - (p3.x - p1.x) * alpha / 3;
        const cp2y = p2.y - (p3.y - p1.y) * alpha / 3;
        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
      }
    }
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("class", cls);
    el.setAttribute("d", d);
    el.setAttribute("fill", "none");
    if (color) el.setAttribute("style", `stroke:${color};`);
    g.appendChild(el);
  };

  let curvePts = [];
  let curveType = null;

  for (const seg of segs) {
    if (!seg || !seg.from || !seg.to) continue;
    if (DART_SKIP.has(seg.type)) continue;

    if (CURVE_TYPES.has(seg.type)) {
      // 타입이 같아도 좌표상 실제로 붙어 있지 않으면(다른 세대/다른 위치의 조각이
      // 우연히 같은 타입으로 이어진 경우) 같은 곡선으로 잇지 않는다 — 안 그러면
      // bakedSegments 순서가 살짝만 어긋나도 화면에서는 매끄럽게 이어진 것처럼
      // 잘못 그려진다.
      const lastPt = curvePts[curvePts.length - 1];
      const isContinuous = lastPt && Math.hypot(lastPt.x - seg.from.x, lastPt.y - seg.from.y) < 0.05;
      if (seg.type !== curveType || !isContinuous) {
        flushSmoothPath(curvePts);
        curvePts = [{ ...seg.from }];
        curveType = seg.type;
      }
      curvePts.push({ ...seg.to });
    } else {
      flushSmoothPath(curvePts);
      curvePts = [];
      curveType = null;
      g.appendChild(LnC(seg.from, seg.to, cls, color));
    }
  }
  flushSmoothPath(curvePts);
}

function drawDartMoveApplied(svg, p, f, B){
  if(typeof dartMoveState === 'undefined') return;
  const _DC_F = DEBUG_COLORS ? DBG_FRONT : null;
  const _DC_B = DEBUG_COLORS ? DBG_BACK  : null;

  function renderApp(app, color) {
    if (!app?.bakedSegments?.length) return;
    const g = E("g");
    // 현재 baked 결과(bakedSegments)는 "지금 붙어있는 하나의 평면 패턴"이다 —
    // 옛 다트 위치의 "참고선"이라는 별도 카테고리를 두지 않는다. dart-leg-new/
    // dart-leg-old(가슴다트 등 잔여 다리 포함)는 전부 drawAppliedSegments를 통해
    // 일반 패턴선과 동일하게 그린다.
    drawAppliedSegments(g, app.bakedSegments, "pattern", color, app.side);
    svg.appendChild(g);
  }

  renderApp(dartMoveState.appliedFront, _DC_F);
  renderApp(dartMoveState.appliedBack,  _DC_B);
}

function drawFrontNeck(svg,f,p,dr,B,W,BL,showPattern,showDep,showDim,gPat,cv){
  const _DC_F = DEBUG_COLORS ? DBG_FRONT : null; // DEBUG
  // 다트이동 적용 시 앞판 원본선 전부 skip (앞목/앞어깨/가슴다트 포함)
  const hasDartMoveApplied_FN = typeof dartMoveState !== 'undefined'
    && dartMoveState.appliedFront != null;
  if(hasDartMoveApplied_FN) return;
  const {nTR,nTL,nBR,nBL,deg22,FSP,GG,deg18,bSNP,bND,bSP,shDx,shDy,dartCenter,dartEnd_,eOnSh,fAux,cAux}=cv;


    // 직사각형 4변
    gPat.appendChild(Ln(nTR, nTL, "dep")); // 상단
    gPat.appendChild(Ln(nTR, nBR, "dep")); // 우측 (앞중심선)
    gPat.appendChild(Ln(nTL, nBL, "dep")); // 좌측
    gPat.appendChild(Ln(nBR, nBL, "dep")); // 하단

    // 대각선: B점(nTR) ↔ 왼쪽하단(nBL)
    gPat.appendChild(Ln(nTR, nBL, "dep"));

    // 대각선 3등분점
    const div1 = {
      x: nTR.x + (nBL.x - nTR.x) * (1/3),
      y: nTR.y + (nBL.y - nTR.y) * (1/3)
    };
    const div2 = {
      x: nTR.x + (nBL.x - nTR.x) * (2/3),
      y: nTR.y + (nBL.y - nTR.y) * (2/3)
    };

    // 대각선 단위벡터 (nTR→nBL 방향)
    const diagLen = Math.hypot(nBL.x - nTR.x, nBL.y - nTR.y);
    const diagUx  = (nBL.x - nTR.x) / diagLen;
    const diagUy  = (nBL.y - nTR.y) / diagLen;

    // div2에서 nBL 방향으로 0.5cm 이동한 안내점
    const guideP = {
      x: div2.x + diagUx * 0.5,
      y: div2.y + diagUy * 0.5
    };

    // 3등분점 표시
    [div1, div2].forEach(pt => {
      gPat.appendChild(dot(pt, "pt-dep", 3));
    });

    // 안내점 표시
    gPat.appendChild(dot(guideP, "pt-main", 4));
    gPat.appendChild(lbl(guideP, "안내점", "txt-dark", 6, -6));

    // ─ 앞목선: FND → 안내점 통과 → SNP (핸들 포함) ─
    {
      const[x1,y1]=c2p(nBR.x,    nBR.y);    // FND (시작)
      const[xg,yg]=c2p(guideP.x, guideP.y); // 안내점
      const[x2,y2]=c2p(nTL.x,    nTL.y);    // SNP (끝)
      const[bx,by]=c2p(nTR.x,    nTR.y);    // B점

      // 안내점 접선
      const tgx=-(yg-by), tgy=(xg-bx);
      const tgLen=Math.hypot(tgx,tgy);
      const tx=tgx/tgLen, ty=tgy/tgLen;
      const d1=Math.hypot(xg-x1,yg-y1)*0.25;
      const d2=Math.hypot(x2-xg,y2-yg)*0.25;

      const FN = state.fNeckH || { h0:{x:nBR.x,y:nBR.y}, h1:{x:nTL.x,y:nTL.y} };
      const[fhx0,fhy0]=c2p(FN.h0.x, FN.h0.y);
      const[fhx1,fhy1]=c2p(FN.h1.x, FN.h1.y);

      // 안내점 앞뒤 핸들은 기존 접선 유지
      const c2x=xg-tx*d1, c2y=yg-ty*d1;
      const c3x=xg+tx*d2, c3y=yg+ty*d2;

      { // DEBUG front neckline path
        const _fnp = E("path",{
          d:`M${x1},${y1} C${fhx0},${fhy0} ${c2x},${c2y} ${xg},${yg}`+
            ` C${c3x},${c3y} ${fhx1},${fhy1} ${x2},${y2}`,
          class:"pattern"
        });
        if(DEBUG_COLORS) _fnp.setAttribute("style", `stroke:${DBG_FRONT};`); // DEBUG
        gPat.appendChild(_fnp);
      }

      // 핸들 드래그
      const mkFN=(hx,hy,ax,ay,col,key)=>{
        gPat.appendChild(E("line",{x1:ax,y1:ay,x2:hx,y2:hy,stroke:col,strokeWidth:0.8,strokeDasharray:"3,2"}));
        const h=E("circle",{cx:hx,cy:hy,r:5,fill:col,stroke:"#fff",strokeWidth:1.5,style:"cursor:grab"});
        h.addEventListener("mousedown",ev=>{
          ev.stopPropagation();
          const onMove=mv=>{
            const[nx,ny]=eventToPatternPoint(mv);
            state.fNeckH[key].x=nx; state.fNeckH[key].y=ny; render();
          };
          const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
          window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
        });
        gPat.appendChild(h);
      };

      mkFN(fhx0,fhy0, x1,y1, "#185FA5","h0"); // FND 핸들
      mkFN(fhx1,fhy1, x2,y2, "#185FA5","h1"); // SNP 핸들
    }

    // ─ 앞어깨선 ──────────────────────────────────
    gPat.appendChild(LnC(nTL, FSP, "pattern", _DC_F));
    if(showDim) gPat.appendChild(dimLine(nTL, FSP, 12));
    gPat.appendChild(dot(FSP, "pt-main", 3));
    gPat.appendChild(lbl(FSP, "FSP", "txt-dark", 6, 10));

    // ─ G점 → BP 직선 + 다트선 ──────────────────
    gPat.appendChild(Ln(p.G,  p.BP, "dart dart-struct")); // 가슴다트 하부
    gPat.appendChild(Ln(p.BP, GG,  "dart dart-struct")); // 가슴다트 상부
    gPat.appendChild(dot(GG, "pt-main", 3));
    gPat.appendChild(lbl(GG, "GG", "txt-dark", 6, -6));
}

function drawFrontArmhole(svg,f,p,dr,B,W,BL,showPattern,showDep,gPat,cv){
  const _DC_F = DEBUG_COLORS ? DBG_FRONT : null; // DEBUG
  // 다트이동 적용 시 앞진동선 원본은 그리지 않는다 (rotatedPts로 대체됨)
  const hasDartMoveApplied_FA = typeof dartMoveState !== 'undefined'
    && dartMoveState.appliedFront != null;
  if(hasDartMoveApplied_FA) return;
  const {nTR,nTL,nBR,nBL,deg22,FSP,GG,deg18,bSNP,bND,bSP,shDx,shDy,dartCenter,dartEnd_,eOnSh,fAux,cAux}=cv;
    // ── 앞진동선: G → GG → FSP (뒤진동선과 연결) ──
    {
      const dGG = Math.hypot(GG.x-p.G.x, GG.y-p.G.y) * 0.4;
      const dF  = Math.hypot(FSP.x-GG.x, FSP.y-GG.y) * 0.4;
      const perpFx = Math.sin(deg22), perpFy = Math.cos(deg22);

      const FH = state.fArmH || { hFa:{x:GG.x,y:GG.y}, hFb:{x:FSP.x,y:FSP.y} };

      const[ggx,ggy]=c2p(GG.x,   GG.y);
      const[fx, fy] =c2p(FSP.x,  FSP.y);
      const[hfax,hfay]=c2p(FH.hFa.x, FH.hFa.y);
      const[hfbx,hfby]=c2p(FH.hFb.x, FH.hFb.y);

      { // DEBUG front armhole path
        const _p = E("path",{
          d:`M${ggx},${ggy} C${hfax},${hfay} ${hfbx},${hfby} ${fx},${fy}`,
          class:"pattern"
        });
        if(DEBUG_COLORS) _p.setAttribute("style", `stroke:${DBG_FRONT};`); // DEBUG
        gPat.appendChild(_p);
      }

      // 핸들 드래그
      const mkFH=(hx,hy,ax,ay,col,key)=>{
        gPat.appendChild(E("line",{x1:ax,y1:ay,x2:hx,y2:hy,stroke:col,strokeWidth:0.8,strokeDasharray:"3,2"}));
        const h=E("circle",{cx:hx,cy:hy,r:5,fill:col,stroke:"#fff",strokeWidth:1.5,style:"cursor:grab"});
        h.addEventListener("mousedown",ev=>{
          ev.stopPropagation();
          const onMove=mv=>{
            const[nx,ny]=eventToPatternPoint(mv);
            state.fArmH[key].x=nx; state.fArmH[key].y=ny; render();
          };
          const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
          window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
        });
        gPat.appendChild(h);
      };

      mkFH(hfax,hfay, ggx,ggy, "#0cf","hFa"); // GG 출발 핸들
      mkFH(hfbx,hfby, fx, fy,  "#e44","hFb"); // FSP 도착 핸들

      gPat.appendChild(E("circle",{cx:ggx,cy:ggy,r:5,fill:"#0cf",stroke:"#fff",strokeWidth:2}));
      gPat.appendChild(E("circle",{cx:fx, cy:fy, r:5,fill:"#e44",stroke:"#fff",strokeWidth:2}));
    }




    // ── 뒤목선 안내선 ─────────────────────────────
}

function drawBackNeck(svg,f,p,dr,B,W,BL,showPattern,showDep,gPat,cv){
  const _DC_B = DEBUG_COLORS ? DBG_BACK : null; // DEBUG
  // 뒤판 다트이동 적용 시 원본 뒤목선 skip (drawDartMoveApplied가 back-neckline 담당)
  const hasBackDartMoveApplied = typeof dartMoveState !== 'undefined'
    && dartMoveState.appliedBack != null;
  if(hasBackDartMoveApplied) return;
  const {nTR,nTL,nBR,nBL,deg22,FSP,GG,deg18,bSNP,bND,bSP,shDx,shDy,dartCenter,dartEnd_,eOnSh,fAux,cAux}=cv;
    gPat.appendChild(Ln(p.A,  bSNP, "dep"));
    gPat.appendChild(Ln(bSNP, bND,  "dep"));
    gPat.appendChild(dot(bSNP, "pt-main", 3));
    gPat.appendChild(lbl(bSNP, "SNP", "txt-dark", 4, 10));
    gPat.appendChild(dot(bND,  "pt-main", 3));
    gPat.appendChild(lbl(bND,  "BND", "txt-dark", 4, -4));

    // ── 뒤목선 곡선: A → bND (핸들 포함) ────────────
    {
      const[x1,y1]=c2p(p.A.x, p.A.y);
      const[x2,y2]=c2p(bND.x, bND.y);
      const d=Math.hypot(x2-x1,y2-y1)*0.5;

      const NH = state.bNeckH || { h0:{x:p.A.x,y:p.A.y}, h1:{x:bND.x,y:bND.y} };
      const[hx0,hy0]=c2p(NH.h0.x, NH.h0.y);
      const[hx1,hy1]=c2p(NH.h1.x, NH.h1.y);

      { // DEBUG back neck path
        const _bnp = E("path",{
          d:`M${x1},${y1} C${hx0},${hy0} ${hx1},${hy1} ${x2},${y2}`,
          class:"pattern"
        });
        if(DEBUG_COLORS) _bnp.setAttribute("style", `stroke:${DBG_BACK};`); // DEBUG
        gPat.appendChild(_bnp);
      }

      // 핸들 드래그
      const mkNH=(hx,hy,ax,ay,col,key)=>{
        gPat.appendChild(E("line",{x1:ax,y1:ay,x2:hx,y2:hy,stroke:col,strokeWidth:0.8,strokeDasharray:"3,2"}));
        const h=E("circle",{cx:hx,cy:hy,r:5,fill:col,stroke:"#fff",strokeWidth:1.5,style:"cursor:grab"});
        h.addEventListener("mousedown",ev=>{
          ev.stopPropagation();
          const onMove=mv=>{
            const[nx,ny]=eventToPatternPoint(mv);
            state.bNeckH[key].x=nx; state.bNeckH[key].y=ny; render();
          };
          const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
          window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
        });
        gPat.appendChild(h);
      };

      mkNH(hx0,hy0, x1,y1, "#a44","h0"); // A점 핸들
      mkNH(hx1,hy1, x2,y2, "#a44","h1"); // bND 핸들
    }

    // ── 뒤어깨선 ──────────────────────────────────
}

function drawBackShoulder(svg,f,p,dr,B,W,BL,showPattern,showDep,showDim,gPat,cv){
  const _DC_B = DEBUG_COLORS ? DBG_BACK : null; // DEBUG
  // 뒤판 다트이동 적용 시 원본 어깨선 skip
  const hasDartMoveApplied_B = typeof dartMoveState !== 'undefined'
    && dartMoveState.appliedBack != null;
  if(hasDartMoveApplied_B) return;
  const {nTR,nTL,nBR,nBL,deg22,FSP,GG,deg18,bSNP,bND,bSP,shDx,shDy,dartCenter,dartEnd_,eOnSh,fAux,cAux}=cv;








    gPat.appendChild(LnC(bND, dartCenter, "pattern", _DC_B));
    gPat.appendChild(LnC(dartEnd_, bSP, "pattern", _DC_B));
    gPat.appendChild(dot(bSP, "pt-main", 3));
    gPat.appendChild(lbl(bSP, "BSP", "txt-dark", 4, 10));
    gPat.appendChild(Ln(p.E, eOnSh, "dep"));
    gPat.appendChild(dot(eOnSh, "pt-main", 4));
    gPat.appendChild(dot(dartCenter, "pt-main", 4));
    gPat.appendChild(lbl(dartCenter, "다트시작", "txt-dark", 4, -6));
    gPat.appendChild(dot(dartEnd_, "pt-main", 4));
    gPat.appendChild(lbl(dartEnd_, "다트끝", "txt-dark", 4, -6));
    gPat.appendChild(LnC(dartCenter, p.E,    "dart dart-struct", _DC_B)); // 뒤어깨다트
    gPat.appendChild(LnC(p.E,        dartEnd_, "dart dart-struct", _DC_B)); // 뒤어깨다트
    if(showDim) gPat.appendChild(dimLine(bND, bSP, 12));

    gPat.appendChild(Ln(p.F, fAux, "dep"));
    gPat.appendChild(dot(fAux, "pt-dep", 3));
    gPat.appendChild(Ln(p.C, cAux, "dep"));
    gPat.appendChild(dot(cAux, "pt-dep", 3));

    // ── 진동선 (5포인트 cubic bezier 핸들) ──────────
}

function drawArmhole(svg,f,p,dr,darts_,B,W,BL,showPattern,showDep,gPat,cv){
  const _DC_F = DEBUG_COLORS ? DBG_FRONT : null; // DEBUG front
  const _DC_B = DEBUG_COLORS ? DBG_BACK  : null; // DEBUG back
  const {nTR,nTL,nBR,nBL,deg22,FSP,GG,deg18,bSNP,bND,bSP,shDx,shDy,dartCenter,dartEnd_,eOnSh,fAux,cAux}=cv;
  const isFrontApplied = typeof dartMoveState !== 'undefined' && dartMoveState.appliedFront != null;
  const isBackApplied  = typeof dartMoveState !== 'undefined' && dartMoveState.appliedBack  != null;
    {
      const perpX = Math.sin(deg18), perpY = -Math.cos(deg18);
      // 5개 앵커점 (고정 2 + 조절 3)
      const A0 = { x: bSP.x,        y: bSP.y        }; // BSP (고정)
      const A1 = { x: cAux.x,       y: cAux.y       }; // C안내
      const A2 = { x: p.SIDE_TOP.x, y: p.SIDE_TOP.y }; // 옆가슴
      const A3 = { x: fAux.x,       y: fAux.y       }; // F안내
      const A4 = { x: p.G.x,        y: p.G.y        }; // G (고정)

      // 핸들 초기값: [앵커x, 앵커y, h1x, h1y, h2x, h2y]
      // BSP: 핸들1개(어깨수직방향), A1~A3: 앞뒤 2개, G: 핸들1개(수직아래)
      const H = state.armH;
      if(!H) return;

      // 화면→패턴 좌표 변환

      // 곡선 그리기 (4구간 cubic bezier)
      const[bx0,by0]=c2p(A0.x,   A0.y);
      const[bx1,by1]=c2p(H.a1.x, H.a1.y);
      const[bx2,by2]=c2p(H.a2.x, H.a2.y);
      const[bx3,by3]=c2p(H.a3.x, H.a3.y);
      const[bx4,by4]=c2p(A4.x,   A4.y);
      const[hx0,hy0]=c2p(H.h0.x,  H.h0.y);
      const[hx1a,hy1a]=c2p(H.h1a.x,H.h1a.y);
      const[hx1b,hy1b]=c2p(H.h1b.x,H.h1b.y);
      const[hx2a,hy2a]=c2p(H.h2a.x,H.h2a.y);
      const[hx2b,hy2b]=c2p(H.h2b.x,H.h2b.y);
      const[hx3a,hy3a]=c2p(H.h3a.x,H.h3a.y);
      const[hx3b,hy3b]=c2p(H.h3b.x,H.h3b.y);
      const[hx4,hy4]=c2p(H.h4.x,  H.h4.y);

      // ── 뒤암홀: BSP → SIDE_TOP ────────────────────────
      if(!isBackApplied){
        const _bpd = `M${bx0},${by0} C${hx0},${hy0} ${hx1a},${hy1a} ${bx1},${by1}`+
                     ` C${hx1b},${hy1b} ${hx2a},${hy2a} ${bx2},${by2}`;
        const _bp = E("path",{ d:_bpd, class:"pattern" });
        if(DEBUG_COLORS) _bp.setAttribute("style", `stroke:${DBG_BACK};`); // DEBUG
        gPat.appendChild(_bp);
      }

      // ── 앞암홀 하부: SIDE_TOP → G (앞판 적용 시 skip) ────────────
      if(!isFrontApplied){
        const _fpd = `M${bx2},${by2} C${hx2b},${hy2b} ${hx3a},${hy3a} ${bx3},${by3}`+
                     ` C${hx3b},${hy3b} ${hx4},${hy4} ${bx4},${by4}`;
        const _fp = E("path",{ d:_fpd, class:"pattern" });
        if(DEBUG_COLORS) _fp.setAttribute("style", `stroke:${DBG_FRONT};`); // DEBUG
        gPat.appendChild(_fp);
      }

      // 핸들선 + 핸들점 그리기 헬퍼
      const mkHandle=(hx,hy,ax,ay,col,key)=>{
        gPat.appendChild(E("line",{x1:ax,y1:ay,x2:hx,y2:hy,stroke:col,strokeWidth:0.8,strokeDasharray:"3,2",opacity:0.7}));
        const h=E("circle",{cx:hx,cy:hy,r:5,fill:col,stroke:"#fff",strokeWidth:1.5,style:"cursor:grab"});
        h.addEventListener("mousedown",ev=>{
          ev.stopPropagation();
          const onMove=mv=>{
            const[nx,ny]=eventToPatternPoint(mv);
            state.armH[key].x=nx; state.armH[key].y=ny;
            render();
          };
          const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
          window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
        });
        gPat.appendChild(h);
      };

      // 앵커점 드래그 헬퍼
      const mkAnchor=(ax,ay,col,akey)=>{
        const h=E("circle",{cx:ax,cy:ay,r:7,fill:col,stroke:"#fff",strokeWidth:2,style:"cursor:grab"});
        h.addEventListener("mousedown",ev=>{
          ev.stopPropagation();
          const[ox,oy]=p2c_(ax,ay);
          const onMove=mv=>{
            const[nx,ny]=eventToPatternPoint(mv);
            const dx=nx-ox, dy=ny-oy;
            // 앵커 + 연결된 핸들 같이 이동
            state.armH[akey].x=nx; state.armH[akey].y=ny;
            if(akey==='a1'){ state.armH.h1a.x+=dx; state.armH.h1a.y+=dy; state.armH.h1b.x+=dx; state.armH.h1b.y+=dy; }
            if(akey==='a2'){ state.armH.h2a.x+=dx; state.armH.h2a.y+=dy; state.armH.h2b.x+=dx; state.armH.h2b.y+=dy; }
            if(akey==='a3'){ state.armH.h3a.x+=dx; state.armH.h3a.y+=dy; state.armH.h3b.x+=dx; state.armH.h3b.y+=dy; }
            render();
          };
          const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
          window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
        });
        gPat.appendChild(h);
      };

      // BSP 핸들
      mkHandle(hx0,hy0, bx0,by0, "#0af","h0");
      // C안내 앵커+핸들
      mkHandle(hx1a,hy1a, bx1,by1, "#0cf","h1a");
      mkHandle(hx1b,hy1b, bx1,by1, "#0cf","h1b");
      mkAnchor(bx1,by1, "#0cf","a1");
      // 옆가슴 앵커+핸들
      mkHandle(hx2a,hy2a, bx2,by2, "#0f9","h2a");
      mkHandle(hx2b,hy2b, bx2,by2, "#0f9","h2b");
      mkAnchor(bx2,by2, "#0f9","a2");
      // F안내 앵커+핸들
      mkHandle(hx3a,hy3a, bx3,by3, "#fa0","h3a");
      mkHandle(hx3b,hy3b, bx3,by3, "#fa0","h3b");
      mkAnchor(bx3,by3, "#fa0","a3");
      // G 핸들
      mkHandle(hx4,hy4, bx4,by4, "#f90","h4");

      // BSP, G 고정점
      gPat.appendChild(E("circle",{cx:bx0,cy:by0,r:5,fill:"#0af",stroke:"#fff",strokeWidth:2}));
      gPat.appendChild(E("circle",{cx:bx4,cy:by4,r:5,fill:"#f90",stroke:"#fff",strokeWidth:2}));
    }


    // ── 옆선 (앞판 + 뒤판) ───────────────────────
    const _dartC = darts_.c;

    // 앞판 옆선: 앞판 적용 시 drawDartMoveApplied 담당
    if(!isFrontApplied){
      gPat.appendChild(LnC(p.SIDE_TOP, p.SIDE_BTM, "pattern", _DC_F));
    }
    // 뒤판 옆선: 뒤판 적용 시 drawDartMoveApplied 담당
    if(!isBackApplied){
      gPat.appendChild(LnC(p.SIDE_TOP, p.SIDE_BTM, "pattern", _DC_B));
    }

    const FND = { x: f.sw(), y: f.yB() + f.fnd() };
    // 앞판 허리선
    if(!isFrontApplied){
      gPat.appendChild(LnC(FND,        p.FRONT_WL, "pattern", _DC_F));
      gPat.appendChild(LnC(p.FRONT_WL, p.SIDE_BTM, "pattern", _DC_F));
    }
    // 뒤판 허리선 + 뒤중심선
    if(!isBackApplied){
      gPat.appendChild(LnC(p.SIDE_BTM, p.BACK_WL,  "pattern", _DC_B));
      gPat.appendChild(LnC(p.BACK_WL,  p.A,         "pattern", _DC_B));
    }

    // ── FRONT_ARM → BP (절개선) ─ 앞판 적용 시 skip ──
    if(!isFrontApplied){
      gPat.appendChild(Ln(p.FRONT_ARM, p.BP, "dep"));
    }

    // ── 진동선 편집 모드: 앞판 회전 ─────────────────
    if(state.armEditMode){
      // GG → G 방향으로 회전 (음수 = 시계방향)
      const rotAngle = -(B/4 - 2.5) * Math.PI / 180;

      // BP를 중심으로 회전
      const rot = (pt) => {
        const dx = pt.x - p.BP.x, dy = pt.y - p.BP.y;
        return {
          x: p.BP.x + dx*Math.cos(rotAngle) - dy*Math.sin(rotAngle),
          y: p.BP.y + dx*Math.sin(rotAngle) + dy*Math.cos(rotAngle)
        };
      };

      // 회전된 앞판 외곽선
      const rFND    = rot(FND);
      const rFSP    = rot(FSP);
      const rSNP    = rot(nTL);
      const rGG     = rot(GG);      // GG → G점 위치로
      const rG      = rot(p.G);     // G → GG 위치로 (확인용)
      const rFRONT_WL = rot(p.FRONT_WL);
      const rFRONT_ARM = rot(p.FRONT_ARM);

      // 회전된 앞판 외곽 (반투명 파란선)
      const gRot = E("g",{opacity:0.7});
      const rotLine = (a,b) => { const l=Ln(a,b,"pattern"); l.setAttribute("stroke","#3399ff"); l.setAttribute("stroke-dasharray","4,2"); return l; };
      gRot.appendChild(rotLine(rFND,     rSNP));
      gRot.appendChild(rotLine(rFND,     rFRONT_WL));
      gRot.appendChild(rotLine(rFSP,     rSNP));
      gRot.appendChild(rotLine(rFRONT_ARM, p.BP));

      // 회전된 진동선 (GG→FSP 구간)
      if(state.fArmH){
        const FH = state.fArmH;
        const rGGpt = rot(GG);
        const rFSPpt = rot(FSP);
        const rhFa = rot(FH.hFa);
        const rhFb = rot(FH.hFb);
        const[rx1,ry1]=c2p(rGGpt.x, rGGpt.y);
        const[rx2,ry2]=c2p(rFSPpt.x,rFSPpt.y);
        const[rhx1,rhy1]=c2p(rhFa.x, rhFa.y);
        const[rhx2,rhy2]=c2p(rhFb.x, rhFb.y);
        const rPath=E("path",{d:`M${rx1},${ry1} C${rhx1},${rhy1} ${rhx2},${rhy2} ${rx2},${ry2}`,stroke:"#3399ff",strokeWidth:2.5,fill:"none",strokeDasharray:"4,2"});
        gRot.appendChild(rPath);
      }

      svg.appendChild(gRot);

      // 연결 상태 표시
      const connDist = Math.hypot(rG.x-GG.x, rG.y-GG.y)*SC*viewZ;
      const info = E("text",{x:20,y:40,fill:"#3399ff","font-size":11,"font-weight":"700"});
      info.textContent = `진동 편집 모드 | G→GG 거리: ${(connDist/SC/viewZ).toFixed(2)}cm`;
      svg.appendChild(info);
    }

    // ── 네크라인 편집 모드 ────────────────────────
    if(state.neckEditMode){
      // bND(뒤옆목점) → nTL(앞옆목점) 기준으로 뒤판 조각 이동+회전
      // 뒤어깨선 방향각 (bND → bSP)
      const bShAngle = Math.atan2(bSP.y - bND.y, bSP.x - bND.x);
      // 앞어깨선 방향각 (nTL → FSP) → 반대방향으로 붙이므로 +180°
      const fShAngle = Math.atan2(FSP.y - nTL.y, FSP.x - nTL.x) + Math.PI;
      const rotA = fShAngle - bShAngle + Math.PI;

      // bND 기준 회전 후 nTL 위치로 이동
      const transform = (pt) => {
        const dx = pt.x - bND.x, dy = pt.y - bND.y;
        const rx = dx*Math.cos(rotA) - dy*Math.sin(rotA);
        const ry = dx*Math.sin(rotA) + dy*Math.cos(rotA);
        return { x: nTL.x + rx, y: nTL.y + ry };
      };

      // 뒤판 조각 꼭짓점
      const tA     = transform(p.A);
      const tbND   = transform(bND);
      const tbSNP  = transform(bSNP);
      const tDS    = transform(dartCenter);   // 다트시작
      const tDE    = transform(dartEnd_);     // 다트끝
      const tBSP   = transform(bSP);           // BSP 이동된 위치
      const tE     = transform(p.E);          // E점
      const tE0    = transform({ x: 0, y: p.E.y }); // x=0, y=E높이

      const gNeck = E("g");
      const nCol  = "#aa44cc";

      const nLn=(a,b)=>{
        const[x1,y1]=c2p(a.x,a.y);
        const[x2,y2]=c2p(b.x,b.y);
        return E("line",{x1,y1,x2,y2,stroke:nCol,strokeWidth:1.5,strokeDasharray:"4,2"});
      };

      // 외곽선
      gNeck.appendChild(nLn(tE0,   tA));      // 뒤중심선
      gNeck.appendChild(nLn(tE0,   tE));      // E수평선 왼쪽
      gNeck.appendChild(nLn(tE,    tBSP));    // E → BSP
      // 어깨선 (다트 포함)
      gNeck.appendChild(nLn(tBSP,  tDE));     // BSP → 다트끝
      gNeck.appendChild(nLn(tDE,   tDS));     // 다트구간
      gNeck.appendChild(nLn(tDS,   tbSNP));   // 다트시작 → bSNP

      // 뒤목선 곡선
      if(state.bNeckH){
        const tH0 = transform(state.bNeckH.h0);
        const tH1 = transform(state.bNeckH.h1);
        const[x1,y1] =c2p(tA.x,   tA.y);
        const[x2,y2] =c2p(tbND.x, tbND.y);
        const[hx0,hy0]=c2p(tH0.x,  tH0.y);
        const[hx1,hy1]=c2p(tH1.x,  tH1.y);
        gNeck.appendChild(E("path",{
          d:`M${x1},${y1} C${hx0},${hy0} ${hx1},${hy1} ${x2},${y2}`,
          stroke:nCol,strokeWidth:2.5,fill:"none"
        }));
      } else {
        gNeck.appendChild(nLn(tA, tbND));
      }
      // bNeckD → bSNP
      gNeck.appendChild(nLn(tbND, tbSNP));
      // bND → 다트시작 (어깨선)
      gNeck.appendChild(nLn(tbND, tDS));

      // 역변환: 이동된 화면좌표 → 원래 패턴좌표
      const inverseTransform = (pt) => {
        const dx = pt.x - nTL.x, dy = pt.y - nTL.y;
        const rx = dx*Math.cos(-rotA) - dy*Math.sin(-rotA);
        const ry = dx*Math.sin(-rotA) + dy*Math.cos(-rotA);
        return { x: bND.x + rx, y: bND.y + ry };
      };

      // 핸들 드래그 헬퍼 (이동된 위치에서 드래그 → 역변환해서 저장)
      const mkNeckH=(hx,hy,ax,ay,col,store,key)=>{
        gNeck.appendChild(E("line",{x1:ax,y1:ay,x2:hx,y2:hy,stroke:col,strokeWidth:0.8,strokeDasharray:"3,2"}));
        const h=E("circle",{cx:hx,cy:hy,r:6,fill:col,stroke:"#fff",strokeWidth:2,style:"cursor:grab"});
        h.addEventListener("mousedown",ev=>{
          ev.stopPropagation();
          const onMove=mv=>{
            const[nx,ny]=eventToPatternPoint(mv);
            // 역변환해서 원래 좌표계에 저장
            const orig = inverseTransform({x:nx, y:ny});
            state[store][key].x = orig.x;
            state[store][key].y = orig.y;
            render();
          };
          const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
          window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
        });
        gNeck.appendChild(h);
      };

      // 뒤목선 핸들 (이동된 위치에서 드래그)
      if(state.bNeckH){
        const tH0 = transform(state.bNeckH.h0);
        const tH1 = transform(state.bNeckH.h1);
        const[ax0,ay0]=c2p(tA.x,   tA.y);
        const[ax1,ay1]=c2p(tbND.x, tbND.y);
        const[hx0,hy0]=c2p(tH0.x,  tH0.y);
        const[hx1,hy1]=c2p(tH1.x,  tH1.y);
        mkNeckH(hx0,hy0, ax0,ay0, "#e44","bNeckH","h0");
        mkNeckH(hx1,hy1, ax1,ay1, "#e44","bNeckH","h1");
      }

      // 앞목선 핸들 (이동 없이 원위치에서 드래그 - 앞판은 그대로)
      if(state.fNeckH){
        const[fx0,fy0]=c2p(nBR.x,  nBR.y);
        const[fx1,fy1]=c2p(nTL.x,  nTL.y);
        const[fhx0,fhy0]=c2p(state.fNeckH.h0.x, state.fNeckH.h0.y);
        const[fhx1,fhy1]=c2p(state.fNeckH.h1.x, state.fNeckH.h1.y);
        const mkFNH=(hx,hy,ax,ay,key)=>{
          gNeck.appendChild(E("line",{x1:ax,y1:ay,x2:hx,y2:hy,stroke:"#185FA5",strokeWidth:0.8,strokeDasharray:"3,2"}));
          const h=E("circle",{cx:hx,cy:hy,r:6,fill:"#185FA5",stroke:"#fff",strokeWidth:2,style:"cursor:grab"});
          h.addEventListener("mousedown",ev=>{
            ev.stopPropagation();
            const onMove=mv=>{
              const[nx,ny]=eventToPatternPoint(mv);
              state.fNeckH[key].x=nx; state.fNeckH[key].y=ny; render();
            };
            const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
            window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
          });
          gNeck.appendChild(h);
        };
        mkFNH(fhx0,fhy0, fx0,fy0, "h0");
        mkFNH(fhx1,fhy1, fx1,fy1, "h1");
      }

      // 주요점 표시
      [[tBSP,"BSP"],[{x:nTL.x,y:nTL.y},"SNP(기준)"],[tA,"A"]].forEach(([pt,nm])=>{
        const[px,py]=c2p(pt.x,pt.y);
        gNeck.appendChild(E("circle",{cx:px,cy:py,r:4,fill:nCol,stroke:"#fff",strokeWidth:1.5}));
        const t_=E("text",{x:px+6,y:py-4,fill:nCol,"font-size":9,"font-weight":"700"});
        t_.textContent=nm; gNeck.appendChild(t_);
      });

      svg.appendChild(gNeck);

      const info=E("text",{x:20,y:55,fill:nCol,"font-size":11,"font-weight":"700"});
      info.textContent="네크라인 편집 모드 | bND → SNP(앞옆목점) 기준";
      svg.appendChild(info);
    }

}

function drawDarts(svg,f,p,dr,darts_,B,W,BL,showBase,showDart,showDep,showPattern,showDim){
  // ── 다트 a~f ─────────────────────────────────
  const gDart=E("g");
  gDart.setAttribute("id","layer-dart");
  drawDart(gDart, darts_.a, "dart-waist");
  drawDart(gDart, darts_.b, "dart-waist");
  drawDart(gDart, darts_.c, "dart-waist");
  drawDart(gDart, darts_.d, "dart-waist");
  drawDart(gDart, darts_.e, "dart-waist");
  // f 다트: 뒤중심선이라 오른쪽만
  gDart.appendChild(Ln(darts_.f.right, darts_.f.apex, "dart-waist"));
  gDart.appendChild(dot(darts_.f.apex, "pt-main", 4));
  if(showDart)svg.appendChild(gDart);
}


function drawDimLines(svg,f,p,dr,darts_,B,W,BL,showBase,showDart,showDep,showPattern,showDim){
  // ── 치수선 ───────────────────────────────────
  if(showDim){
    const gd=E("g");
    gd.setAttribute("id","layer-dim");
    gd.appendChild(dimLine(p.A,          p.BACK_WL,            -22)); // ① 등길이
    gd.appendChild(dimLine(p.BACK_WL,    p.FRONT_WL,            16)); // ② 신폭
    gd.appendChild(dimLine(p.A,          {x:0,y:f.yBL()},      -38)); // ③ 진동깊이
    gd.appendChild(dimLine({x:0,y:f.yBL()},p.BACK_WL,          -54)); // BL~WL
    gd.appendChild(dimLine({x:0,y:f.yBL()},p.C,                 16)); // ⑤ 뒤품
    gd.appendChild(dimLine({x:f.bw(),y:0},p.C,                  14)); // ⑥ 배폭선 높이
    gd.appendChild(dimLine(p.A,          {x:f.bw(),y:0},        -14)); // ⑦ A 수평선
    gd.appendChild(dimLine({x:0,y:f.yD()},p.D,                  -14)); // ⑧ 수평선
    gd.appendChild(dimLine({x:f.bw(),y:0},p.D,                   16)); // ⑧ A→D 세로
    gd.appendChild(dimLine(p.B,          p.FRONT_WL,             22)); // ⑨ 앞길이
    gd.appendChild(dimLine(p.FRONT_TL,   p.B,                   -14)); // ⑩ B수평선
    gd.appendChild(dimLine(p.FRONT_ARM,  {x:f.sw(),y:f.yBL()},  16)); // ⑪ 앞품
    gd.appendChild(dimLine(p.FRONT_TL,   p.FRONT_ARM,            14)); // ⑫ 앞품선 세로
    gd.appendChild(dimLine(p.F,          {x:f.sw(),y:f.yBL()},  30)); // ⑬ F~앞중심
    gd.appendChild(dimLine(p.G,          p.F,                    16)); // ⑬ G→F
    gd.appendChild(dimLine({x:f.bw(),y:f.yG()},p.G,             -14)); // ⑬ G선 가로
    gd.appendChild(dimLine(p.C,          p.F,                    32)); // ⑭ C~F
    gd.appendChild(dimLine(p.SIDE_TOP,   p.SIDE_BTM,             16)); // ⑭ 옆선 세로
    // 다트 너비
    [darts_.a,darts_.b,darts_.c,darts_.d,darts_.e,darts_.f].forEach((d,i)=>{
      gd.appendChild(dimLine(d.left, d.right, -16-i*6));
    });
    svg.appendChild(gd);
  }

}

function drawPoints(svg,f,p,dr,darts_,B,W,BL,showBase,showDart,showDep,showPattern,showDim){
  // ── 포인트 & 레이블 ──────────────────────────
  // 표시옵션과 점/라벨을 같은 기준으로 묶는다.
  // - 기초선 OFF: A/B/C/D/E 같은 기초점 숨김
  // - 종속선 OFF: G/⑭ 같은 종속점 숨김
  // - 패턴선 OFF: F/BP 같은 패턴 기준점 숨김
  // - 다트 OFF: a~f 다트점 숨김
  const gp=E("g");
  gp.setAttribute("id","layer-points");

  const addPoint = (pt, name, cls, enabled=true) => {
    if(!enabled) return;
    gp.appendChild(dot(pt,cls));
    gp.appendChild(lbl(pt,name,cls==="pt-dep"?"txt-dep":cls==="pt-main"?"txt-dark":"txt"));
  };

  // 기초점
  [
    [p.A, "A"], [p.B, "B"], [p.C, "C"], [p.D, "D"], [p.E, "E"]
  ].forEach(([pt,name]) => addPoint(pt, name, "pt", showBase));

  // 패턴 기준점
  addPoint(p.F,  "F",  "pt-main", showPattern);
  addPoint(p.BP, "BP", "pt-main", showPattern);

  // 종속 기준점
  addPoint(p.G,        "G",  "pt-dep", showDep);
  addPoint(p.SIDE_TOP, "⑭", "pt-dep", showDep);

  // 다트 apex 포인트
  if(showDart){
    [darts_.a,darts_.b,darts_.c,darts_.d,darts_.e,darts_.f].forEach((d,i)=>{
      const names=["a","b","c","d","e","f"];
      gp.appendChild(dot(d.apex,"pt-main",3.5));
      gp.appendChild(lbl(d.apex,names[i],"txt-dark",5,-5));
    });
  }

  // B/F 판 이름은 패턴선 표시가 켜져 있을 때만 보이게 한다.
  if(showPattern){
    {const[px,py]=c2p(f.bw()*0.4, f.yWL()*0.45);
     gp.appendChild(E("text",{x:px,y:py,"font-size":22,"font-weight":"700",fill:"#ddd","text-anchor":"middle"},"B"));}
    {const[px,py]=c2p(f.sw()-f.fw()*0.4, f.yWL()*0.45);
     gp.appendChild(E("text",{x:px,y:py,"font-size":22,"font-weight":"700",fill:"#ddd","text-anchor":"middle"},"F"));}
  }

  svg.appendChild(gp);
}


