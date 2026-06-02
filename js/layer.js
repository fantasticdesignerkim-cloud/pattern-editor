// ── 구조 안정화: 표시 레이어 분류/제어 ─────────────────────
function getUiOptions(){
  return {
    base:    document.getElementById("chkBase")?.checked    !== false,
    dart:    document.getElementById("chkDart")?.checked    !== false,
    dim:     document.getElementById("chkDim")?.checked     === true,
    pattern: document.getElementById("chkPattern")?.checked !== false,
    dep:     document.getElementById("chkDep")?.checked     === true,
    guide:   document.getElementById("chkGuide")?.checked   === true,
    body:    state.workMode !== "sleeve",
    sleeve:  state.workMode !== "body",
    edit:    !!(state.armEditMode || state.neckEditMode || state.sleeveEditMode)
  };
}

function classifyVisualElement(el){
  const cls = el.getAttribute("class") || "";
  const tag = el.tagName.toLowerCase();
  const txt = (el.textContent || "").trim();
  const dash = el.getAttribute("strokeDasharray") || el.getAttribute("stroke-dasharray") || "";
  const hasGrab = (el.getAttribute("style") || "").includes("cursor:grab") || (el.getAttribute("style") || "").includes("cursor: grab");

  if(/grid-m|grid-M/.test(cls)) return "grid";
  if(/ease-info/.test(cls)) return "misc";  // 이세량 패널: 항상 표시
  if(hasGrab || /sleeve-pattern-handle|sleeve-pattern-handle-pt/.test(cls) || dash === "3,2") return "handle";
  if(/dim/.test(cls) || /^(-?\d+(\.\d+)?|뒤암홀|앞암홀|총이세|뒤이세|앞이세|뒤AH|앞AH|EL|SL)/.test(txt)) return "dimension";
  if(/dart|dart-guide/.test(cls)) return "dart";
  if(/base/.test(cls)) return "base";
  if(/pattern|sleeve-pattern-line|sleeve-cap/.test(cls)) return "pattern";
  if(/dep|rBL|rWL|sleeve-front-guide|sleeve-back-guide|sleeve-sch|sleeve-front-circ|sleeve-back-circ|sleeve-culture|sleeve-guide-label|txt-dep/.test(cls)) return "guide";
  if(tag === "circle" || /pt|txt-dark/.test(cls)) return "point";
  if(tag === "text") return "point";
  return "misc";
}

function toggleLayer(id, visible){
  const el = document.getElementById(id);
  if(el) el.style.display = visible ? "" : "none";
}

function applyLayerVisibility(){
  const opt = getUiOptions();
  const visible = {
    grid: true,
    base: opt.base,
    dart: opt.dart,
    pattern: opt.pattern,
    guide: opt.dep,
    point: opt.guide,
    dimension: opt.dim,
    handle: opt.edit,
    misc: true
  };

  svg.querySelectorAll("path,line,circle,text").forEach(el=>{
    const layer = classifyVisualElement(el);
    el.setAttribute("data-layer", layer);
    el.style.display = visible[layer] ? "" : "none";
  });
}

