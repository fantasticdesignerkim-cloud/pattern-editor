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

let panStart=null,spaceDown=false;
document.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();spaceDown=true;svg.style.cursor="grab";}});
document.addEventListener("keyup",e=>{if(e.code==="Space"){spaceDown=false;svg.style.cursor="";}});
svg.addEventListener("pointerdown",e=>{
  if(e.button===0&&spaceDown){panStart={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};svg.setPointerCapture(e.pointerId);}
});
svg.addEventListener("pointermove",e=>{
  if(!panStart)return;
  view.x=panStart.vx+(e.clientX-panStart.x);
  view.y=panStart.vy+(e.clientY-panStart.y);
  syncViewVars();
  render();
});
svg.addEventListener("pointerup",()=>{panStart=null;});

let pD0=null,pZ0=null,pMX=null,pMY=null;
svg.addEventListener("touchstart",e=>{
  if(e.touches.length===2){e.preventDefault();
    const t1=e.touches[0],t2=e.touches[1];
    pD0=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);pZ0=viewZ;
    const r=svg.getBoundingClientRect();
    pMX=(t1.clientX+t2.clientX)/2-r.left;pMY=(t1.clientY+t2.clientY)/2-r.top;}
},{passive:false});
svg.addEventListener("touchmove",e=>{
  if(e.touches.length===2&&pD0){e.preventDefault();
    const t1=e.touches[0],t2=e.touches[1];
    const d2=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
    const nz=Math.min(Math.max(pZ0*d2/pD0,_minZoom()),10);
    view.x=pMX-view.MX-(pMX-view.MX-view.x)*(nz/view.z);
    view.y=pMY-view.MY-(pMY-view.MY-view.y)*(nz/view.z);
    view.z=nz;
    syncViewVars();
    render();}
},{passive:false});
svg.addEventListener("touchend",e=>{if(e.touches.length<2)pD0=null;},{passive:true});

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
