// ── 치수선 ────────────────────────────────────
function dimLine(a,b,off=14){
  const g=E("g");
  const[x1,y1]=c2p(a.x,a.y),[x2,y2]=c2p(b.x,b.y);
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
  if(len<1)return g;
  const nx=-dy/len,ny=dx/len,ox=nx*off,oy=ny*off;
  g.appendChild(line(x1+ox,y1+oy,x2+ox,y2+oy,"dim"));
  [[x1,y1],[x2,y2]].forEach(([px,py])=>{
    g.appendChild(line(px,py,px+ox,py+oy,"dim"));
    g.appendChild(line(px+ox-nx*4,py+oy-ny*4,px+ox+nx*4,py+oy+ny*4,"dim"));
  });
  const dist=Math.hypot(b.x-a.x,b.y-a.y);
  g.appendChild(E("text",{
    x:(x1+x2)/2+ox*1.5,y:(y1+y2)/2+oy*1.5,
    "font-size":9,fill:"#e07800","text-anchor":"middle","font-weight":"700"
  },dist.toFixed(1)));
  return g;
}

// ══════════════════════════════════════════════
// 소매 원형 엔진
// ══════════════════════════════════════════════
function createSleeveDraft(B, sleeveLen, bAH, fAH, sleeveCapHeight){
  // bAH: 뒤진동 길이, fAH: 앞진동 길이
  const SL = sleeveLen;  // 소매길이 (52cm)

  // ── 소매 배치 기준점 ─────────────────────────
  // 몸판 좌표계 그대로 사용, 소매는 WL 아래 5cm에 배치
  // 소매 중심선 x = 몸판 신폭/2 (가운데)
  const sw = B/2+6;
  const ox = sw/2;    // 소매 중심 x
  const oy_margin = 5; // WL 아래 여백

  // ── 소매산 높이 ──────────────────────────────
  // 몸판의 앞/뒤 어깨점 높이에서 계산한 값을 우선 사용한다.
  const SCH = sleeveCapHeight ?? ((bAH + fAH) / 4 - 1);

  // ── 소매폭 ───────────────────────────────────
  // 뒤소매폭: bAH + 1 (+ ★은 이세량, 일단 0)
  // 앞소매폭: fAH / 4 × 비율 → 실제로는 전체에서 뒤를 뺀 값
  const bSW = bAH + 1;  // 뒤소매폭
  const fSW = fAH;      // 앞소매폭
  const totalSW = bSW + fSW; // 전체 소매폭

  // ── 기준점 ───────────────────────────────────
  // 소매산점 (SP): 중심선 위
  // BL선: 소매산점에서 SCH 아래
  // 소매구선: 소매산점에서 SL 아래
  // 팔꿈치선: SL/2 + 2.5

  const formula = {
    ox()    { return ox; },           // 소매 중심 x
    SCH()   { return SCH; },          // 소매산 높이
    bSW()   { return bSW; },          // 뒤소매폭
    fSW()   { return fSW; },          // 앞소매폭
    totalSW(){ return totalSW; },     // 전체 소매폭
    EL()    { return SL/2 + 2.5; },  // 팔꿈치선 y (소매산점 기준)
    SL()    { return SL; },           // 소매길이
  };

  return { formula };
}


function createDraft(B,W,BL){

  // ── 공식 (교재 86~87p) ─────────────────────
  const formula={
    FL()  { return B/5+8.3;  },   // ⑨ 앞길이
    cd()  { return B/12+13.7;},   // ③ 진동깊이→BL선
    bw()  { return B/8+7.4;  },   // ⑤ 뒤품
    fw()  { return B/8+6.2;  },   // ⑪ 앞품
    sw()  { return B/2+6;    },   // ② 신폭
    yBL() { return this.cd();},   // BL선 y
    yWL() { return BL;        },  // WL선 y
    yB()  { return this.yBL()-this.FL(); }, // ⑨ B점 y
    yD()  { return 8;         },  // ⑧ D점 y = 8cm 고정 (교재)
    xD()  { return this.bw(); },  // D점 x = 배폭선
    xE()  { return this.bw()/2+1;}, // ⑧ E점 x
    xF()  { return this.sw()-this.fw()-B/32; }, // ⑬ F점 x
    yG()  { return (this.yBL()+this.yD())/2+0.5; }, // ⑬ G점 y
    sideX(){ return (this.bw()+this.xF())/2; }, // ⑭ 옆선 x
    bpX() { return this.sw()-this.fw()/2-0.7; }, // ⑪ BP x
    totalDart(){ return n("inpDart")||12.5; },
    // 뒤목 공식 (교재 87p: B/24+3.4+0.2)
    bnw() { return B/24+3.4+0.2; }, // 뒤목너비
    bnd() { return this.bnw()/3;  }, // 뒤목깊이 = bnw/3
    // 앞목 공식
    fnw() { return B/24+3.4;      }, // 앞목너비 ◎
    fnd() { return this.fnw()+0.5;}, // 앞목깊이 = ◎+0.5
  };

  // ── 포인트 (공식으로 계산) ──────────────────
  const pts={
    A:   {x:0,              y:0           },
    B:   {x:formula.sw(),   y:formula.yB()},  // ⑨
    C:   {x:formula.bw(),   y:formula.yBL()}, // ⑤
    D:   {x:formula.xD(),   y:formula.yD()},  // ⑧
    E:   {x:formula.xE(),   y:formula.yD()},  // ⑧
    F:   {x:formula.xF(),   y:formula.yBL()}, // ⑬
    G:   {x:formula.xF(),   y:formula.yG()},  // ⑬
    BP:  {x:formula.bpX(),  y:formula.yBL()}, // ⑪
    SIDE_TOP:   {x:formula.sideX(), y:formula.yBL()}, // ⑭
    SIDE_BTM:   {x:formula.sideX(), y:formula.yWL()}, // ⑭
    BACK_WL:    {x:0,               y:formula.yWL()},
    FRONT_WL:   {x:formula.sw(),    y:formula.yWL()},
    FRONT_TL:   {x:formula.sw()-formula.fw(), y:formula.yB()},  // ⑩ 끝점
    FRONT_ARM:  {x:formula.sw()-formula.fw(), y:formula.yBL()}, // ⑫ 앞품선 하단

  };

  // ── 패턴선 공식은 formula 안으로 통합됨 ────────
  const deg = r => r * Math.PI / 180;

  // ── 패턴 포인트 계산 ────────────────────────
  // 뒤목
  const BNW  = formula.bnw();  // B/24+3.4+0.2
  const BND_ = formula.bnd();  // BNW/3
  const bSNP   = { x: BNW, y: 0      }; // A점에서 오른쪽 BNW
  const bNeckD = { x: BNW, y: -BND_  }; // bSNP에서 위로 BND_ = 뒤옆목점

  // 뒤어깨선: SNP → 18° 아래-오른쪽 방향
  // 앞어깨 길이를 먼저 구함: SNP에서 22° → FRONT_ARM.x에서 수직선과의 교점 + 1.8
  const FNW = formula.fnw();
  const FND_ = formula.fnd();
  const fSNP = { x: formula.sw() - FNW, y: formula.yB() }; // 앞 SNP
  // 앞어깨: SNP에서 22° 아래-왼쪽(-x)방향, FRONT_ARM.x(=sw-fw)까지 x 이동 거리
  const fSh_dx = fSNP.x - (formula.sw() - formula.fw()); // SNP.x - 앞품선x
  const fSh_len = fSh_dx / Math.cos(deg(22));            // 어깨선 길이 (앞품선까지)
  const fSh_total = fSh_len + 1.8;                        // +1.8cm 연장
  const fSP = {
    x: fSNP.x - fSh_total * Math.cos(deg(22)),
    y: fSNP.y + fSh_total * Math.sin(deg(22))
  };

  // 뒤어깨 길이 = 앞어깨 전체길이 + B/32 - 0.8
  const bSh_len = fSh_total + B/32 - 0.8;
  const bSP = {
    x: bSNP.x + bSh_len * Math.cos(deg(18)),
    y: bSNP.y + bSh_len * Math.sin(deg(18))
  };

  // 뒤진동 안내점: C점(=bw, BL)에서 45° 방향으로 ▲+0.8
  // ▲ = C점에서 옆선까지 거리의 1/4 (교재 관례) → 실제로는 (C→SIDE_TOP 거리)/4
  const bArm_dist = formula.sideX() - formula.bw(); // C~옆선 수평거리
  const bArm_guide_r = bArm_dist / 4 + 0.8;
  const bAH = {  // 뒤진동 안내점
    x: formula.bw() + bArm_guide_r * Math.cos(deg(45)),
    y: formula.yBL() - bArm_guide_r * Math.sin(deg(45))
  };

  // 앞진동 안내점: G점(=F.x, G.y) 기준 45° 방향 ▲+0.5
  const fArm_dist = formula.sideX() - formula.xF();
  const fArm_guide_r = fArm_dist / 4 + 0.5;
  const fAH = {  // 앞진동 안내점
    x: formula.xF() - fArm_guide_r * Math.cos(deg(45)),
    y: formula.yBL() - fArm_guide_r * Math.sin(deg(45))
  };

  // 앞목선 안내점: 직사각형(FNW × FND) 대각선을 3등분, 하단에서 0.5 내린 점
  // 대각선 = FNW 방향, 3등분 하단 1/3 점
  const fNeck_guide = {
    x: fSNP.x + FNW * (1/3),            // 대각선 1/3: x는 SNP에서 +FNW/3
    y: fSNP.y + FND_ * (2/3) + 0.5      // y는 2/3 아래 + 0.5
  };

  // ── 패턴 포인트 등록 ────────────────────────
  pts.bSNP  = bSNP;
  pts.bNeckD= bNeckD;
  pts.bSP   = bSP;
  pts.bAH   = bAH;
  pts.fSNP  = fSNP;
  pts.fNeckBot = { x: formula.sw(), y: fSNP.y + FND_ }; // 앞목 최하점
  pts.fNeckG = fNeck_guide;
  pts.fSP   = fSP;
  pts.fAH   = fAH;

  // ── 허리다트 (a~f) ─────────────────────────
  const total=formula.totalDart();
  const darts={
    total,
    a: total*0.14,  // BP 아래
    b: total*0.15,  // F점 1.5cm 전중심쪽
    c: total*0.11,  // 옆선
    d: total*0.35,  // 뒤품선~옆선 1cm 뒤중심
    e: total*0.18,  // E점 0.5cm 뒤중심
    f: total*0.07,  // 뒤중심
  };

  return {formula, pts, darts};
}

// ── 다트 헬퍼 ────────────────────────────────────
function makeDart(amount, apex, yWL){
  const center={x:apex.x, y:yWL};
  return {
    amount, apex, center,
    left:  {x:apex.x-amount/2, y:yWL},
    right: {x:apex.x+amount/2, y:yWL}
  };
}
function drawDart(g, d, cls){
  g.appendChild(Ln(d.center, d.apex, "dart-guide"));
  g.appendChild(Ln(d.left,   d.apex, cls));
  g.appendChild(Ln(d.right,  d.apex, cls));
  g.appendChild(dot(d.apex, "pt-main", 4));
}

