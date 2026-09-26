# Design 형상 통합 결과 이력

> 세 완료본을 묶는 designResult(2026-08).

> 이 파일은 **완료된 작업의 이력**이다. 매 세션 로드되지 않고 필요할 때만 읽는다.
> 살아있는 계약은 [../../CLAUDE.md](../../CLAUDE.md), 색인은 [../INDEX.md](../INDEX.md).

## ✅ Design 형상 통합 결과 (designResult) — 세 완료본 + structuralLines (2026-08, `770f13b`)

몸판·소매·카라 세 완료본을 **하나의 세션 형상 패키지 `working.designResult` 로 묶는다**. **재단 패턴이
아니다** — 다음 파트명·수량·식서·시접·너치(재단) 단계가 오직 현재 유효한 **`designResult.hash`** 에
고정될 앵커다. `js/designResult.js`(`window.designResult`: check/complete/latest/isCurrentDesignChanged).

### 다운스트림 재현성 감사 결과(구현 전 읽기 전용) → structuralLines 보강
- 세 frozen result 는 앞·뒤 유효 외곽·여밈·소매 외곽/소매산·스탠드/본체 외곽을 **이미** 담는다.
- **`role:"cut"` 절개선은 어떤 result 에도 없다**(working.patternLines 에만) → **structuralLines.cut 으로 보강**.
  `boundary` 는 이미 effective outline 에 합성돼 원본 선 중복 저장 불필요.
- cut 은 bodiceResult.hash·스테일 판정에도 미포함 → **designResult.hash 가 structuralLines 를 포함**해야
  cut 변경이 "Design 변경됨"으로 잡힌다.

### 완료 게이트·스냅샷 (잠금)
- 게이트: 몸판·소매·카라 result **모두 존재·비스테일** / sleeve·collar 의 `sourceBodiceHash===bodice.hash` /
  collar 의 소매 작업 순서 정상(`sleeveStepChanged` false) / 유효 cut 이 **현재 effective outline 에서 재검증**.
  실패 코드: `no-bodice`·`bodice-changed`·`no-sleeve`·`sleeve-changed`·`sleeve-bodice-mismatch`·
  `no-collar`·`collar-changed`·`collar-bodice-mismatch`·`collar-sleeve-order`·`sleeve-source-mismatch`·
  `collar-source-mismatch`.
- 스냅샷: `{schemaVersion:1, sourceBlock, bodiceHash/sleeveHash/collarHash, bodice/sleeve/collar(하위 frozen
  result 참조 — clone 아님), structuralLines:{cut:[{piece,segments}]}, hash, completedAt}`. deepFreeze
  (structuralLines·sourceBlock·최상위; 하위는 이미 frozen). **세션 전용**(reload 소멸).
- `hash = hashStr(sub-hashes + canonCuts)`. **idempotent**: 같은 상태 재완료 → 기존 참조·`completedAt` 불변.
  완료 후 형상 수정은 기존 결과를 삭제하지 않고 "Design 변경됨" 표시.

### ★ 사용자 지시로 교정된 네 계약 구멍(초안 → 최종)
1. **UI 갱신 경로 독립성(stale 금지)**: `refresh()` 가 서브탭 활성 여부와 무관하게 **항상 현재 project 로
   `updateDesignResultUI()`**(hidden 이어도 갱신, null 이면 자체 가드로 "Design 미완료"). cut **생성·삭제·
   역할 변경·편집** 후 designLineTool 이 `notifyDesignResult()`→`window.refreshDesignResultUI` 훅 호출.
   몸판 완료/재완료는 `updateBodiceCheckpointUI` 끝에서, 소매·카라는 기존 체크포인트 체인이 이미 갱신.
   → 완료 핸들러를 호출해야만 갱신되던 경로 의존성 제거(실측: refresh() 단독으로 정확 상태·버튼).
2. **전역 symmetry 제거**: designResult 에 `symmetry` 필드를 두지 않는다 — 조각마다 접힘이 다르다
   (앞여밈 몸판=비대칭 / 뒤판=CB fold / 소매=완성 1피스 / 스탠드·칼라 본체=CB fold 반패턴). 파트별 접힘·
   수량은 다음 재단 단계 몫. **하위 `collarResult.symmetry` 는 유지.**
3. **cut 검증 기준 = frozen 몸판**: `gatherValidCuts(patternLines, bodiceResult)` — mutable working outline 이
   아니라 **완료된 몸판(frozen) `bodiceResult.front/back.outline` 기준**(몸판 완료 후 표류 격리).
   role=cut·piece=front/back 만, **canonical 정렬**(patternLine 배열·id 순서 무관 → design hash 안정).
   ★ **raw path primitive 정규화**: `bodiceResult[piece].outline` 은 `{kind:"path", commands}` 를 담아
   `flattenLine` 이 `[null,null]` 을 내고 validateCut 이 크래시했다 → `outlinePrimsToSegs`(outlineSegsOf 와
   공유)로 line/cubic 정규화 후 평탄화. UI 문구는 내부명 대신 **`유효 절개선 N개`**.
4. **세션 정직성**: 하드 리로드 → `designWorkflow.current()` null → **bodiceResult/sleeveResult/
   collarResult/designResult 네 개 전부 소멸**, 디자인 탭 disabled, storage 0(실측 확인 — 이전 "bodiceResult
   생존"은 실제 리로드가 아니라 세션 내 조작이 소매·카라만 지운 것이었음).

### 검증
- 하네스: **designResultCheck 25 PASS**(게이트 11 실패 모드·불변 스냅샷·frozen·idempotent·cut 변경 hash·
  하위 hash 변경·cut 순서 무관·전역 symmetry 없음·frozen 몸판 명시 전달) + **designLineToolCheck 109**
  (gatherValidCuts path-form outline **null-pair 회귀**·canonical 정렬·role/piece 필터·segments 복사본).
  runAll 전체 통과, **shape/perf 골든 diff 0**.
- 실브라우저(격리 origin `127.0.0.1:8420`, storage 0, 콘솔 0): frozen 몸판 기준 gatherValidCuts 크래시 없음·
  valid 1 / **refresh() 단독으로 정확 상태**(완료 핸들러 없이) · body 서브탭(카라 hidden)에서도 갱신 /
  **cut 편집+hook 단독으로 "Design 변경됨"** / 완료 → "Design 형상 완료됨(원형 v1) · 유효 절개선 1개" /
  하위(카라) 재완료 → "Design 변경됨" / idempotent 재완료 → "변경 없음" / 하드 리로드 네 result 소멸.
- **DOM id**: `btnCompleteDesign`·`designResultCheckNote`·`designResultStatusNote` 추가. 캐시
  `?v=2026082701`(designLineTool·designResult·ui).

**남은 것/경계**: `working.designResult` 는 **파생 형상 패키지**(원본 geometry 미대체). 파트명·수량·식서·
시접·너치(재단 단계)는 `designResult.hash` 에 고정하되 **별도 사양·승인 후**. `structuralLines` 를 cut 외로
확장하지 않는다(boundary 는 effective outline 에 이미 합성).
