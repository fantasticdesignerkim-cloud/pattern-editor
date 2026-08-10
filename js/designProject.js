// ══════════════════════════════════════════════
// js/designProject.js — 디자인 프로젝트(D1: 세션 데이터 로직만).
//
// 완료본(blockMaster CompletedBlock)을 **명시적으로 복사**해 세션 메모리에
// designProject 를 만든다. 원형을 아래 잠금 reference 로 깔고, 위의 디자인
// working geometry 만 편집하는 구조의 데이터 기반이다.
// **UI·renderer·render.js hook·design stage 활성화는 이 파일에 없다(D2/D3).**
//
// 공개 namespace(데이터=designProject, 관리자=designWorkflow — blockWorkflow/
// CompletedBlock 명명 관례와 동일):
//   window.designWorkflow = Object.freeze({ startFromBlock, current, hasProject })
//     · startFromBlock(completedBlock) → designProject (deep clone; reference·baseSource 동결)
//       — 인자가 CompletedBlock 임을 이름에 명시. 첫 UI 는 blockWorkflow.latest() 를 넘긴다.
//     · current() → 현재 designProject 또는 null
//     · hasProject() → 세션 project 존재 여부(boolean)
//
// 계약:
//  - 전역 원형 state/dartMoveState/measurements 에 **로드하지 않는다**(draft swap 금지).
//  - 기존 dartMove/curve edit 엔진을 재사용하지 않는다(여기선 순수 데이터).
//  - `referenceGeometry`·`baseSource` 는 deepFrozen(불변). 원형 완료본은 절대 변경 안 함.
//  - `working.geometry`·`working.parameters` 는 디자인의 **실제 편집 대상**(mutable) —
//    캐시가 아니다. 향후 편집은 이 둘만 바꾼다.
//  - completed 와 **참조 공유 0**(deep clone). localStorage/autoSave/testSeed 미연결.
//  - (SV2) snapshot.schemaVersion 이 2 가 아니면 `unsupported-schema-version` 으로 거부.
//  - **design 하나만**(design-1). 기존 design 이 있으면 **다른 원형 version 으로 자동 교체
//    금지**: 같은 완료본(id+version+canonicalHash) 재시작 → 기존 project 반환(idempotent),
//    다른 version → `Error("design-project-exists")`.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const DESIGN_ID = "design-1";
  let _project = null;   // 세션 메모리 전용. 현재는 하나만.

  function fail(reason, detail) {
    const e = new Error("designWorkflow: " + reason);
    e.reason = reason;
    if (detail !== undefined) e.detail = detail;
    throw e;
  }

  function deepClone(v) {
    if (v === null || v === undefined) return v;
    if (typeof structuredClone === "function") return structuredClone(v);
    return JSON.parse(JSON.stringify(v));
  }
  function deepFreeze(o) {
    if (o && typeof o === "object" && !Object.isFrozen(o)) {
      Object.keys(o).forEach(k => deepFreeze(o[k]));
      Object.freeze(o);
    }
    return o;
  }
  function deepFrozenClone(v) { return deepFreeze(deepClone(v)); }

  // CompletedBlock 최소 형태 검증(blockWorkflow.complete() 반환 형태).
  function validCompleted(c) {
    return !!(c && typeof c === "object"
      && typeof c.id === "string"
      && typeof c.version === "number"
      && typeof c.canonicalHash === "string"
      && c.snapshot && typeof c.snapshot === "object"
      && c.snapshot.source && typeof c.snapshot.source === "object"
      && c.snapshot.geometry && typeof c.snapshot.geometry === "object");
  }

  function startFromBlock(completed) {
    if (!validCompleted(completed)) fail("invalid-completed-block");
    // SV2: 디자인은 의미 모서리(edge)를 실은 schemaVersion 2 완료본만 소비한다.
    // 구형 v1(모서리 없음) snapshot 은 명시적으로 거부한다(조용히 edge 없는 디자인 생성 금지).
    if (completed.snapshot.schemaVersion !== 2) fail("unsupported-schema-version", completed.snapshot.schemaVersion);
    if (_project) {
      const sb = _project.sourceBlock;
      const same = sb.id === completed.id
        && sb.version === completed.version
        && sb.canonicalHash === completed.canonicalHash;
      if (same) return _project;              // idempotent — 같은 완료본 재시작(계약 13)
      fail("design-project-exists");          // 다른 version 자동 교체 금지(계약 12·14)
    }

    const project = {
      id: DESIGN_ID,
      sourceBlock: Object.freeze({
        id: completed.id,
        version: completed.version,
        canonicalHash: completed.canonicalHash
      }),
      createdAt: new Date().toISOString(),                              // 표시 metadata
      baseSource: deepFrozenClone(completed.snapshot.source),          // 동결 근거(불변)
      referenceGeometry: deepFrozenClone(completed.snapshot.geometry), // 불변 reference
      working: {
        geometry: deepClone(completed.snapshot.geometry),             // 실제 편집 대상(mutable)
        parameters: {},
        // 작업 화면 배치(세션 전용, cm). 형상 좌표가 아니라 표시 offset 이다 — reference 와
        // working 에 동일 offset 을 적용해 함께 움직인다. 앞판/뒤판/소매 각각 독립 offset,
        // placement 는 피스별 "auto"|"manual"(사용자가 드래그하면 manual). 초기 side-by-side
        // 배치는 enterDesign 이 autoLayout 으로 채운다(designLayout).
        layout: {
          front: { dx: 0, dy: 0 }, back: { dx: 0, dy: 0 }, sleeve: { dx: 0, dy: 0 },
          placement: { front: "auto", back: "auto", sleeve: "auto" }
        }
      }
    };
    // top-level 동결: id/sourceBlock/baseSource/referenceGeometry/working **참조**는 불변,
    // 단 working 객체 자체는 얕은 freeze 대상이 아니므로 working.geometry/parameters 의
    // **내용**은 편집 가능하다(계약 6·8).
    Object.freeze(project);
    _project = project;
    return project;
  }

  function current() { return _project; }
  function hasProject() { return _project !== null; }

  window.designWorkflow = Object.freeze({
    startFromBlock: startFromBlock,
    current: current,
    hasProject: hasProject
  });
})();
