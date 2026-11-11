// 편집 시작 전 상태를 Undo 스택에 저장하고, 마우스를 놓으면 자동 저장한다.
svg.addEventListener("mousedown",()=>{
  if(state.armEditMode || state.neckEditMode || state.sleeveEditMode) pushUndoSnapshot();
}, true);
window.addEventListener("mouseup",()=>{
  if(state.armEditMode || state.neckEditMode || state.sleeveEditMode) markAutoSave();
}, true);
window.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){
    e.preventDefault();
    if(e.shiftKey) redoEdit(); else undoEdit();
  }
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='y'){ e.preventDefault(); redoEdit(); }
});

// design 은 body-anchored fit 이 viewZ<0.2 로 내려갈 수 있어, 수동 줌 하한을 0.1 로 둔다
// (draft 는 0.2 유지). 이래야 auto-fit 저zoom 상태에서 첫 조작이 0.2 로 튀지 않는다.
function _minZoom(){ return (window.isDesignStageActive && window.isDesignStageActive()) ? 0.1 : 0.2; }
svg.addEventListener("wheel",e=>{
  e.preventDefault();
  const[mx,my]=svgPt(e),dz=e.deltaY<0?1.12:1/1.12;
  const nz=Math.min(Math.max(view.z*dz,_minZoom()),10);
  view.x=mx-view.MX-(mx-view.MX-view.x)*(nz/view.z);
  view.y=my-view.MY-(my-view.MY-view.y)*(nz/view.z);
  view.z=nz;
  syncViewVars();
  render();
},{passive:false});

// 화면 이동(2026-11-11 리뷰 보완): 팬·핀치 계산은 canvasPan.js 한 곳(뷰 변환만 · 형상 무변경). 여기서는 Space 상태만 소유한다.
//   · Space 를 누른 채 드래그 = 즉시 팬(종전 명시적 팬 수단 · 모든 stage).
//   · 입력칸·키보드로 포커스한 버튼/체크박스의 Space(글자 입력·누르기)는 가로채지 않는다 — 마우스로 누른 버튼에 포커스가 남은 경우는 종전처럼 팬.
//   · 창 전환(blur)·탭 숨김(visibilitychange)에서 Space 를 놓친 채(keyup 미수신) 남지 않게 해제 → 복귀 후 선 도구·조각 드래그 먹통 방지.
let spaceDown=false;
function _spaceForControl(t){
  if(!t||t===document.body||t===document.documentElement)return false;
  if(t.isContentEditable)return true;
  const tag=t.tagName;
  if(tag==="TEXTAREA"||tag==="SELECT")return true;
  if(tag==="INPUT"){const ty=(t.type||"text").toLowerCase();if(!/^(checkbox|radio|button|submit|reset|range|color|file|image)$/.test(ty))return true;}
  if(tag==="INPUT"||tag==="BUTTON"||tag==="A"||tag==="SUMMARY"||(t.getAttribute&&t.getAttribute("role")==="button")){
    try{return t.matches(":focus-visible");}catch(_){return false;}   // 키보드로 온 포커스 = 그 컨트롤의 Space
  }
  return false;
}
function releaseSpace(){ if(!spaceDown)return; spaceDown=false; svg.style.cursor=""; if(window.canvasPan&&!window.canvasPan.panning())window.canvasPan.cancel(); }
document.addEventListener("keydown",e=>{
  if(e.code!=="Space"||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
  if(_spaceForControl(e.target))return;
  e.preventDefault();spaceDown=true;if(!(window.canvasPan&&window.canvasPan.panning()))svg.style.cursor="grab";
});
document.addEventListener("keyup",e=>{if(e.code==="Space"&&spaceDown){e.preventDefault();releaseSpace();}});
window.addEventListener("blur",()=>{ releaseSpace(); if(window.canvasPan)window.canvasPan.cancel(); });
document.addEventListener("visibilitychange",()=>{ if(document.hidden){ releaseSpace(); if(window.canvasPan)window.canvasPan.cancel(); } });
svg.addEventListener("pointerdown",e=>{
  if(e.button===0&&spaceDown&&window.canvasPan)window.canvasPan.press(e,null,{immediate:true});
});

function resetView(){
  // design 화면에서는 배치(layout)를 건드리지 않고 기본 zoom 복원 + 몸판 재중앙만.
  if (window.designLayout && typeof window.isDesignStageActive === "function" && window.isDesignStageActive()){
    window.designLayout.resetViewForDesign();
    return;
  }
  Object.assign(view, {SC:11,MX:80,MY:100,x:0,y:0,z:1});
  syncViewVars();
  render();
}

generatePattern();
initDartMoveClickHandler();
// 홈페이지 최초 화면의 union 중앙 fit 은 draftLayout 의 ResizeObserver(#cv) 가 소유한다.
// (observe 시 초기 콜백 + 레이아웃 확정/hidden→visible 시 콜백이 전달되어 자동 fit)
// generatePattern 의 render 끝 훅(afterDraftRender)이 그 전에 소매 offset 을 맞춰 둔다.
