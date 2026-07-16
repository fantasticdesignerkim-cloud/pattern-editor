let isMeasureDirty = false;
function markDirty(ev){
  isMeasureDirty = true;
  const el = document.getElementById("dirtyState");
  if(el){
    el.textContent = "치수 변경됨 · 패턴 생성 버튼을 누르세요";
    el.style.color = "#e07800";
    el.style.fontWeight = "700";
  }
  // 몸판 치수(B/W/BL)가 바뀔 때만 몸판 핸들 리셋
  // 소매단둘레(inpHem)는 소매 하단 폭만 바꾸므로 몸판/소매산 핸들을 리셋하지 않는다
  const changedId = ev?.target?.id;
  if(changedId !== "inpHem"){
    resetBodyCurveHandles();
  }
}
// ── 핸들 초기화 (render 밖에서 실행) ──────────────
// render()는 state를 읽기만 하고, 핸들 초기화는 여기서만 한다.
function initHandles(f, p, B){
  // 앞목선 핸들
  if(!state.fNeckH){
    const circ = f.fnw(), fnd = f.fnd();
    const nTR = { x: f.sw(),      y: f.yB()     };
    const nTL = { x: f.sw()-circ, y: f.yB()     };
    const nBR = { x: f.sw(),      y: f.yB()+fnd };
    const nBL = { x: f.sw()-circ, y: f.yB()+fnd };
    const diagLen = Math.hypot(nBL.x-nTR.x, nBL.y-nTR.y);
    const diagUx  = (nBL.x-nTR.x)/diagLen, diagUy = (nBL.y-nTR.y)/diagLen;
    const div2 = { x: nTR.x+(nBL.x-nTR.x)*(2/3), y: nTR.y+(nBL.y-nTR.y)*(2/3) };
    const guideP = { x: div2.x+diagUx*0.5, y: div2.y+diagUy*0.5 };
    const d1 = Math.hypot(guideP.x-nBR.x, guideP.y-nBR.y)*0.25;
    const d2 = Math.hypot(nTL.x-guideP.x, nTL.y-guideP.y)*0.25;
    state.fNeckH = {
      h0: { x: nBR.x - d1, y: nBR.y      },
      h1: { x: nTL.x,      y: nTL.y + d2 },
    };
  }

  // 앞진동선 핸들
  if(!state.fArmH){
    const deg22 = 22*Math.PI/180;
    const nTL = { x: f.sw()-f.fnw(), y: f.yB() };
    const shLen_ = (nTL.x-(f.sw()-f.fw()))/Math.cos(deg22);
    const FSP = { x: nTL.x-(shLen_+1.8)*Math.cos(deg22), y: nTL.y+(shLen_+1.8)*Math.sin(deg22) };
    const vx_=p.BP.x-p.G.x, vy_=p.BP.y-p.G.y;
    const len_=Math.hypot(vx_,vy_);
    const ux_=-vx_/len_, uy_=-vy_/len_;
    const da_=(B/4-2.5)*Math.PI/180;
    const GG = { x: p.BP.x+(ux_*Math.cos(da_)-uy_*Math.sin(da_))*len_, y: p.BP.y+(ux_*Math.sin(da_)+uy_*Math.cos(da_))*len_ };
    const dF  = Math.hypot(FSP.x-GG.x, FSP.y-GG.y)*0.4;
    const perpFx = Math.sin(deg22), perpFy = Math.cos(deg22);
    state.fArmH = {
      hGa: { x: p.G.x,                    y: p.G.y - Math.hypot(GG.x-p.G.x,GG.y-p.G.y)*0.4 },
      hGb: { x: GG.x+(p.G.x-GG.x)*0.3,   y: GG.y+(p.G.y-GG.y)*0.3 },
      hFa: { x: GG.x-(FSP.x-GG.x)*0.3,   y: GG.y-(FSP.y-GG.y)*0.3 },
      hFb: { x: FSP.x+perpFx*dF,          y: FSP.y+perpFy*dF        },
    };
  }

  // 뒤목선 핸들
  if(!state.bNeckH){
    const bND = { x: f.bnw(), y: -f.bnd() };
    const d = Math.hypot(bND.x-p.A.x, bND.y-p.A.y)*0.5;
    state.bNeckH = {
      h0: { x: p.A.x + d, y: p.A.y      },
      h1: { x: bND.x,     y: bND.y + d  },
    };
  }

  // 뒤진동선 핸들
  if(!state.armH){
    const deg18 = 18*Math.PI/180;
    const deg22 = 22*Math.PI/180;
    const bND = { x: f.bnw(), y: -f.bnd() };
    const fSNP_x = f.sw()-f.fnw();
    const armX   = f.sw()-f.fw();
    const fShLen = (fSNP_x-armX)/Math.cos(deg22)+1.8;
    const bShLen = fShLen+B/32-0.8;
    const bSP = { x: bND.x+bShLen*Math.cos(deg18), y: bND.y+bShLen*Math.sin(deg18) };
    const segLen  = (p.F.x-p.SIDE_TOP.x)/3+0.5;
    const segLen2 = (p.F.x-p.SIDE_TOP.x)/3+0.8;
    const fAux = { x: p.F.x-segLen*Math.cos(Math.PI/4),  y: p.F.y-segLen*Math.sin(Math.PI/4)  };
    const cAux = { x: p.C.x+segLen2*Math.cos(Math.PI/4), y: p.C.y-segLen2*Math.sin(Math.PI/4) };
    const A0=bSP, A1=cAux, A2=p.SIDE_TOP, A3=fAux, A4=p.G;
    const perpX=Math.sin(deg18), perpY=-Math.cos(deg18);
    const d01=Math.hypot(A1.x-A0.x,A1.y-A0.y)*0.4;
    const d34=Math.hypot(A4.x-A3.x,A4.y-A3.y)*0.4;
    state.armH = {
      h0:  { x: A0.x-perpX*d01,           y: A0.y-perpY*d01           },
      h1a: { x: A1.x+perpX*d01,           y: A1.y+perpY*d01           },
      h1b: { x: A1.x-(A2.x-A1.x)*0.3,    y: A1.y-(A2.y-A1.y)*0.3    },
      h2a: { x: A2.x+(A1.x-A2.x)*0.3,    y: A2.y+(A1.y-A2.y)*0.3    },
      h2b: { x: A2.x-(A3.x-A2.x)*0.3,    y: A2.y-(A3.y-A2.y)*0.3    },
      h3a: { x: A3.x+(A2.x-A3.x)*0.3,    y: A3.y+(A2.y-A3.y)*0.3    },
      h3b: { x: A3.x-(A4.x-A3.x)*0.3,    y: A3.y-(A4.y-A3.y)*0.3    },
      h4:  { x: A4.x,                     y: A4.y+d34                 },
      a1: {...A1}, a2: {...A2}, a3: {...A3},
    };
  }
}

function generatePattern(){
  isMeasureDirty = false;
  const el = document.getElementById("dirtyState");
  if(el){
    el.textContent = "패턴 생성 완료";
    el.style.color = "#0F6E56";
    el.style.fontWeight = "700";
  }
  // 치수가 바뀌었으면 핸들 리셋 후 재초기화
  const B=n("inpB"), W=n("inpW"), BL=n("inpBL");
  if(B && W && BL){
    const d = createDraft(B, W, BL);
    initHandles(d.formula, d.pts, B);
  }
  render();
}


function toggleNeckEdit(){
  if(!state.neckEditMode) setWorkMode("body");
  state.neckEditMode = !state.neckEditMode;
  const btn = document.getElementById("btnNeckEdit");
  btn.textContent  = state.neckEditMode ? "편집 종료" : "편집 시작";
  btn.style.background = state.neckEditMode ? "#cc3333" : "#aa44cc";
  render();
}

function toggleSleeveEdit(){
  if(!state.sleeveEditMode) setWorkMode("sleeve");
  state.sleeveEditMode = !state.sleeveEditMode;
  const btn = document.getElementById("btnSleeveEdit");
  btn.textContent  = state.sleeveEditMode ? "편집 종료" : "편집 시작";
  btn.style.background = state.sleeveEditMode ? "#cc3333" : "#ff8800";
  render();
}

// ── 진동선 편집 모드 ──────────────────────────
function toggleArmEdit(){
  if(!state.armEditMode) setWorkMode("body");
  state.armEditMode = !state.armEditMode;
  const btn = document.getElementById("btnArmEdit");
  btn.textContent  = state.armEditMode ? "편집 종료" : "편집 시작";
  btn.style.background = state.armEditMode ? "#cc3333" : "#3399ff";
  render();
}


// ── 소매산 앵커 개별 리셋 ──────────────────────
function resetSleeveAnchors(){
  resetSleeveCurveHandles();
  render();
  const btn = document.getElementById("btnSleeveReset");
  if(btn){ btn.textContent = "리셋됨 ✓"; setTimeout(()=>{ btn.textContent = "소매산 리셋"; }, 1200); }
}
