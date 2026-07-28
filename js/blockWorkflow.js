// ══════════════════════════════════════════════
// js/blockWorkflow.js — 원형(블록) 완료 수명주기: 세션 메모리 전용 로직.
//
// 공개 API (namespace 하나):
//   window.blockWorkflow = Object.freeze({
//     complete, latest, versions, hasCompleted, isCurrentDraftChanged
//   })
//
// 경계 / 계약:
//  - captureBlockSnapshot() 는 순수 캡처 API 그대로 사용한다(blockMaster.js 무변경).
//  - localStorage·IndexedDB·파일·autoSave 와 연결하지 않는다(메모리 전용).
//  - uiState 에 block/version/completion 상태를 넣지 않는다. 여기(모듈 내부)에만 둔다.
//  - UI·완료 버튼·상태 문구·stage 전환은 이 파일이 하지 않는다(자동 stage 전환 없음).
//  - 현재는 block 계열 하나(block-1)만 지원한다. 다중 block/project 는 범위 밖.
//
// 완료본(CompletedBlock) 래퍼 = 순수 snapshot 을 감싼다:
//   { id, version, completedAt, canonicalHash, snapshot }
//   · id/version/completedAt/canonicalHash 는 래퍼에만(snapshot 밖).
//   · completedAt 은 표시 metadata 이며 identity 에 쓰지 않는다.
//   · snapshot 전체(schemaVersion+source+geometry)가 canonical identity 의 기준.
//
// identity 판정:
//   · 내부 canonicalString(재귀 key 정렬 + 1e-4 정규화)의 완전 일치 = idempotency.
//   · canonicalHash(32bit)는 표시·빠른 비교용일 뿐, hash 만으로 판정하지 않는다.
//   · canonicalString 은 외부 API 로 노출하지 않는다(내부 _records 에만 보관).
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const BLOCK_ID = "block-1";
  // 완료 이력(append-only). 각 항목: { block: <deepFrozen CompletedBlock>, canonicalString }.
  // canonicalString 은 여기(내부)에만 두고 block 래퍼·공개 API 로 노출하지 않는다.
  const _records = [];

  function fail(reason, detail) {
    const e = new Error("blockWorkflow: " + reason);
    e.reason = reason;
    if (detail !== undefined) e.detail = detail;
    throw e;
  }

  function deepFreeze(o) {
    if (o && typeof o === "object" && !Object.isFrozen(o)) {
      Object.keys(o).forEach(k => deepFreeze(o[k]));
      Object.freeze(o);
    }
    return o;
  }

  // 결정적 canonical 직렬화: 재귀 key 정렬 + 숫자 1e-4 정규화(view 왕복 노이즈 제거).
  // NaN/Infinity 는 명시적 실패. undefined/function 등 비직렬화 타입도 실패.
  function canonicalize(v) {
    if (v === null) return "null";
    const t = typeof v;
    if (t === "number") {
      if (!isFinite(v)) fail("non-finite-number", v);
      let x = Math.round(v * 1e4) / 1e4;
      if (x === 0) x = 0; // -0 → 0 정규화
      return String(x);
    }
    if (t === "string") return JSON.stringify(v);
    if (t === "boolean") return v ? "true" : "false";
    if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
    if (t === "object") {
      const keys = Object.keys(v).sort();
      return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
    }
    fail("uncanonicalizable-type", t);
  }

  function hash32(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function currentSnapshot() {
    if (typeof captureBlockSnapshot !== "function") fail("capture-unavailable");
    // captureBlockSnapshot 은 precondition(busy/edit/…) 위반 시 throw 한다 → 그대로 전파.
    return captureBlockSnapshot();
  }

  // 치수 편집 후 아직 패턴을 재생성하지 않은 상태(isMeasureDirty)면 입력(신)과 렌더
  // 형상(구)이 불일치한다. 이때 완료하면 measurements/geometry 가 어긋난 snapshot 이
  // 남으므로 workflow 스스로 막는다(capture·busy·handles 검사보다 먼저). isMeasureDirty
  // 는 handles.js 의 전역 lexical 바인딩(bare 접근). 없으면 dirty 아님으로 본다.
  function measurementsDirty() {
    return (typeof isMeasureDirty !== "undefined") && !!isMeasureDirty;
  }

  // ── complete: 현재 draft 를 완료본으로 확정한다 ──
  // 실패(capture throw / 비유한 숫자)면 _records·latest 는 전혀 바뀌지 않는다.
  function complete() {
    // 순서: ①isMeasureDirty 검사 → ②dirty면 throw → ③capture → ④canonicalize →
    //       ⑤최신 canonicalString 비교 → ⑥deepFreeze → ⑦_records.push(유일 commit).
    if (measurementsDirty()) fail("measure-dirty");   // ①② dirty gate (capture 전 — 최우선)
    const snapshot = currentSnapshot();               // ③ 캡처 (throw → 무변화)
    const canonicalString = canonicalize(snapshot);   // ④ NaN/Inf → 무변화
    const canonicalHash = hash32(canonicalString);
    const prev = _records.length ? _records[_records.length - 1] : null;

    // ⑤ 최신과 canonicalString 완전 일치 → 새 version 없이 기존 최신본 반환(idempotent).
    if (prev && prev.canonicalString === canonicalString) return prev.block;

    // 최신과 다르면 version+1(과거 version 과 같아도 최신과 다르면 새 version).
    const version = prev ? prev.block.version + 1 : 1;
    const block = deepFreeze({                          // ⑥ deepFreeze
      id: BLOCK_ID,
      version: version,
      completedAt: new Date().toISOString(),  // 표시 metadata 전용
      canonicalHash: canonicalHash,           // 표시·빠른 비교용
      snapshot: snapshot                       // 순수 캡처 결과(불변)
    });

    _records.push({ block: block, canonicalString: canonicalString }); // ⑦ 유일한 커밋
    return block;
  }

  function latest() {
    return _records.length ? _records[_records.length - 1].block : null;
  }

  // 완료 이력(오래된→최신). 내부 배열을 노출하지 않도록 매번 새 배열을 돌려준다
  // (원소는 deepFrozen 이라 어차피 변형 불가).
  function versions() {
    return _records.map(r => r.block);
  }

  function hasCompleted() {
    return _records.length > 0;
  }

  // 현재 draft 가 "최신 완료본" 과 다른가. 명시적 호출 전용(실시간 감지 아님).
  // 완료본이 없으면 true(완료본과 대비할 대상이 없으므로 "변경됨"으로 본다).
  function isCurrentDraftChanged() {
    const prev = _records.length ? _records[_records.length - 1] : null;
    if (!prev) return true;                            // 완료본 없음 → 변경됨
    if (measurementsDirty()) return true;             // dirty → capture 호출 없이 변경됨
    const snapshot = currentSnapshot();               // busy/edit → throw 전파
    return canonicalize(snapshot) !== prev.canonicalString;
  }

  window.blockWorkflow = Object.freeze({
    complete: complete,
    latest: latest,
    versions: versions,
    hasCompleted: hasCompleted,
    isCurrentDraftChanged: isCurrentDraftChanged
  });
})();
