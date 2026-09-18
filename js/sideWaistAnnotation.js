// ══════════════════════════════════════════════
// sideWaistAnnotation.js — 디자인 몸판의 원형 옆허리 억제(c) 보조 표시 모델(순수, 표시 전용).
//
// 원형에서 앞·뒤 사이드 허리 사선은 각각 그 조각의 외곽 완성선이고, 두 선이 허리선에서 벌어진 총량이
// 옆허리 억제 c 다(구조화 다트 아님). 디자인은 앞·뒤를 떼어 배치하므로 원형의 V 가 보이지 않는다 —
// 이 모델은 조각마다 원형(reference) 기본 옆선의 진동밑점에서 허리 높이까지 내린 수직 보조선과,
// 그 보조선 ↔ 원형 옆선 허리점 사이 치수(원형 c/2)를 만든다.
//
// ★ 형상이 아니다: pattern geometry·checkpoint·hash·layout·hit 영역·출력 어디에도 들어가지 않는다.
// ★ 식별은 명시 의미만: reference outline 에서 edge "side-seam" 이면서 boundary root 가 "<piece>/side-seam"
//   (또는 boundary 없음 = legacy 명시 edge)인 기본 옆선 1개. 허리 아래 연장(root …/side-seam-extension)은
//   기본 옆선이 아니다. 허리 끝점 = 그 옆선과 명시 edge "waist" 구간이 공유하는 끝점(위상 접점).
// ★ 현재 유효 working 외곽에 측정 가능한 기본 옆선이 없으면(generic unresolved 대체가 삼킴 등) 그 조각은
//   표시하지 않는다 — 몸판 완료 게이트(bodiceCheckpoint.measureSideSeam)와 같은 판정을 주입받아 쓴다.
// ★ 값은 원형 reference 의 좌표에서 결정론적으로 계산(하드코딩 없음). 디자인 조작 후에도 "원형" 값이다.
//   수직 = reference 조각 좌표계의 y 축(원형 중심선 grain 이 +y 로 안정 — DB1 연장축 조사).
//
// buildModel(project, { measureSideSeam }) → {
//   front: { available:true, underarm, waist, guideBottom, halfCm } | { available:false, reason },
//   back:  〃,
//   totalCm: number|null      // 앞·뒤 둘 다 available 일 때만
// }
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var JOIN = 1e-4;   // 같은 끝점(공유 접점) 판정 — blockMaster junction 정규화와 같은 크기

  function ends(s) { return s && s.kind === "line" ? [s.from, s.to] : null; }
  function same(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) <= JOIN; }
  function isPrimary(s, pc) {
    if (!s || s.edge !== "side-seam") return false;
    var r = s.boundary && s.boundary.root;
    return !s.boundary || r === pc + "/side-seam";
  }
  function effectiveOutline(project, pc) {
    var dO = project.working && project.working.designOutline && project.working.designOutline[pc];
    if (dO && Array.isArray(dO.outline) && dO.outline.length) return dO.outline;
    var g = project.working && project.working.geometry && project.working.geometry[pc];
    return (g && Array.isArray(g.outline)) ? g.outline : null;
  }

  function pieceModel(project, pc, measure) {
    var ref = project.referenceGeometry && project.referenceGeometry[pc];
    var outline = ref && Array.isArray(ref.outline) ? ref.outline : [];
    var prim = outline.filter(function (s) { return isPrimary(s, pc); });
    if (prim.length !== 1 || !ends(prim[0])) return { available: false, reason: "no-reference-primary" };
    var waistEnds = [];
    outline.forEach(function (s) { if (s.edge === "waist") { var e = ends(s); if (e) waistEnds.push(e[0], e[1]); } });
    var pe = ends(prim[0]);
    var atWaist = pe.filter(function (q) { return waistEnds.some(function (w) { return same(q, w); }); });
    if (atWaist.length !== 1) return { available: false, reason: "no-reference-junction" };
    var waist = atWaist[0], underarm = same(pe[0], waist) ? pe[1] : pe[0];
    // 현재 유효 working 외곽이 측정 불가(기본 옆선 없음)면 표시하지 않는다 — 좌표로 복원하지 않는다.
    var m = measure ? measure(effectiveOutline(project, pc)) : null;
    if (!m || m.status !== "measured") return { available: false, reason: "working-side-unmeasured" };
    return {
      available: true,
      underarm: { x: underarm.x, y: underarm.y },
      waist: { x: waist.x, y: waist.y },
      guideBottom: { x: underarm.x, y: waist.y },
      halfCm: Math.abs(waist.x - underarm.x)
    };
  }

  function buildModel(project, deps) {
    if (!project || !project.referenceGeometry || !project.working) return null;
    var measure = deps && deps.measureSideSeam;
    var front = pieceModel(project, "front", measure), back = pieceModel(project, "back", measure);
    return { front: front, back: back, totalCm: (front.available && back.available) ? front.halfCm + back.halfCm : null };
  }

  window.sideWaistAnnotation = Object.freeze({ buildModel: buildModel });
})();
