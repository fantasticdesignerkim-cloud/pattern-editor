function bezierLen(pts, n=100){
  let len=0, prev=pts[0];
  for(let i=1;i<=n;i++){
    const t=i/n, mt=1-t;
    const x=mt*mt*mt*pts[0][0]+3*mt*mt*t*pts[1][0]+3*mt*t*t*pts[2][0]+t*t*t*pts[3][0];
    const y=mt*mt*mt*pts[0][1]+3*mt*mt*t*pts[1][1]+3*mt*t*t*pts[2][1]+t*t*t*pts[3][1];
    len+=Math.hypot(x-prev[0],y-prev[1]); prev=[x,y];
  }
  return len;
}

// ── 전역 좌표 변환 함수 ───────────────────────
// 화면(px) → 패턴(cm) 좌표 변환
function p2c_(sx, sy){ return [(sx-MX-viewX)/(SC*viewZ), (sy-MY-viewY)/(SC*viewZ)]; }
// 마우스 이벤트 → 패턴 좌표
function eventToPatternPoint(mv){
  const r = svg.getBoundingClientRect();
  return p2c_(mv.clientX - r.left, mv.clientY - r.top);
}


const state = {
  armH:         null,  // 뒤진동선 핸들
  fArmH:        null,  // 앞진동선 핸들
  bNeckH:       null,  // 뒤목선 핸들
  fNeckH:       null,  // 앞목선 핸들
  sleeveH:      null,  // 소매산 패턴선 핸들
  armEditMode:  false, // 진동선 편집 모드
  neckEditMode: false, // 네크라인 편집 모드
  sleeveEditMode:false, // 소매산 편집 모드
  workMode:     "all", // all/body/sleeve
  undoStack:    [],
  redoStack:    [],
  autoSaveTimer:null
};

"use strict";
const NS="http://www.w3.org/2000/svg";
const svg=document.getElementById("cv");

// ── 뷰 상태 객체 (전역 변수 대신 한 곳에서 관리) ──
const view = { SC:11, MX:80, MY:100, x:0, y:0, z:1 };
let SC=view.SC, MX=view.MX, MY=view.MY, viewX=view.x, viewY=view.y, viewZ=view.z;
function syncViewVars(){ SC=view.SC; MX=view.MX; MY=view.MY; viewX=view.x; viewY=view.y; viewZ=view.z; }
let lastBodyMeasureKey = "";
let lastSleeveMeasureKey = "";

function resetBodyCurveHandles(){
  state.armH = null;
  state.fArmH = null;
  state.bNeckH = null;
  state.fNeckH = null;
}
function resetSleeveCurveHandles(){
  state.sleeveH = null;
}
function resetCurveHandles(){
  resetBodyCurveHandles();
  resetSleeveCurveHandles();
}

function serializeEditState(){
  return JSON.stringify({
    armH: state.armH, fArmH: state.fArmH, bNeckH: state.bNeckH, fNeckH: state.fNeckH, sleeveH: state.sleeveH,
    capFormula: document.getElementById("selCapFormula")?.value || "culture",
    inputs: { SL:n("inpSL"), CapAdj:n("inpCapAdj") }  // Hem 제거: 소매단둘레는 소매산 핸들과 무관
  });
}
function applyEditSnapshot(snap){
  if(!snap) return;
  const s = typeof snap === "string" ? JSON.parse(snap) : snap;
  state.armH=s.armH||null; state.fArmH=s.fArmH||null; state.bNeckH=s.bNeckH||null; state.fNeckH=s.fNeckH||null; state.sleeveH=s.sleeveH||null;
  if(s.capFormula && document.getElementById("selCapFormula")) document.getElementById("selCapFormula").value=s.capFormula;
  if(s.inputs){
    if(document.getElementById("inpSL")) document.getElementById("inpSL").value=s.inputs.SL||n("inpSL");
    if(document.getElementById("inpCapAdj")) document.getElementById("inpCapAdj").value=s.inputs.CapAdj||0;
  }
}
function pushUndoSnapshot(){
  const snap = serializeEditState();
  if(state.undoStack[state.undoStack.length-1] !== snap){
    state.undoStack.push(snap);
    if(state.undoStack.length>60) state.undoStack.shift();
    state.redoStack.length=0;
  }
}
function undoEdit(){
  if(state.undoStack.length===0) return;
  const cur = serializeEditState();
  const prev = state.undoStack.pop();
  state.redoStack.push(cur);
  applyEditSnapshot(prev);
  render();
}
function redoEdit(){
  if(state.redoStack.length===0) return;
  const cur = serializeEditState();
  const next = state.redoStack.pop();
  state.undoStack.push(cur);
  applyEditSnapshot(next);
  render();
}
function markAutoSave(){
  clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = setTimeout(()=>autoSaveCurveData(), 250);
}
function setWorkMode(mode){
  state.workMode = mode;
  ["All","Body","Sleeve"].forEach(k=>{
    const el=document.getElementById("mode"+k);
    if(el) el.classList.toggle("active", mode.toLowerCase()===k.toLowerCase());
  });
  render();
}

// 몸판 암홀은 B/W/BL 기준으로만 리셋한다.
// 소매단둘레나 소매길이를 바꿔도 몸판 암홀 핸들이 움직이면 안 된다.
function getBodyMeasureKey(){
  return `${n("inpB")}-${n("inpW")}-${n("inpBL")}`;
}
// 소매산 패턴선은 소매산/기장 관련 기준이 바뀔 때만 리셋한다.
// 소매단둘레는 하단 폭만 바꾸므로 소매산 핸들을 리셋하지 않는다.
function getSleeveMeasureKey(){
  const capMode = document.getElementById("selCapFormula")?.value || "culture";
  return `${getBodyMeasureKey()}-${n("inpSL")}-${n("inpCapAdj")}-${capMode}`;
}

function n(id){return+(document.getElementById(id)?.value||0);}
function c2p(x,y){return[MX+x*SC*viewZ+viewX, MY+y*SC*viewZ+viewY];}
function svgPt(e){const r=svg.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];}
function E(tag,a={},txt){
  const el=document.createElementNS(NS,tag);
  for(const[k,v]of Object.entries(a))el.setAttribute(k,v);
  if(txt!==undefined)el.textContent=txt;
  return el;
}
function line(x1,y1,x2,y2,cls){return E("line",{x1,y1,x2,y2,class:cls});}
function Ln(a,b,cls){const[x1,y1]=c2p(a.x,a.y),[x2,y2]=c2p(b.x,b.y);return line(x1,y1,x2,y2,cls);}
function dot(p,cls="pt",r=3.2){const[x,y]=c2p(p.x,p.y);return E("circle",{cx:x,cy:y,r,class:cls});}
function lbl(p,t,cls="txt",dx=5,dy=-5){const[x,y]=c2p(p.x,p.y);return E("text",{x:x+dx,y:y+dy,class:cls},t);}
