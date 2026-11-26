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


---

> 아래는 2026-11-26에 이전한 옛 STATUS 기록이다. 당시 진행 표기와 원문 링크를 보존했다. 상대 링크의 기준은 원래 위치인 `docs/STATUS.md`다.

~~~~markdown
## 맞춤 길이 카드 1차 (2026-11-13 김님 승인 «2번 맞춤 길이 검사로 넘어가자» · 미커밋 · v2026.11.13.2)

봉제 전에 서로 붙는 선의 실제 길이·차이·비교 기준을 디자인 단계 한곳(서브탭 줄 바로 아래 · 몸판/소매/카라 탭 공통 · 기본 접힘 한 줄 요약)에서 본다.
**읽기 전용 파생 표시** — 형상·프로젝트·저장 형식·완료 hash 무변경, 자동 길이 맞춤·완료 차단 없음. 패턴 옆 기존 길이 라벨은 그대로.

- **파일**: 신규 `js/seamMatch.js`(모델 `compute` + 표시) · `index.html`(카드 마크업 · 스크립트 1줄 · 버전 · apple.css 캐시) · `css/apple.css`(카드·배지 3색 추가) ·
  신규 `test/harness/seamMatchCheck.js`(47 · 권위 stub) · `test/harness/seamMatchIntegrationCheck.js`(50 · **실제 엔진** · 둘 다 runAll 등록) · `collarPresetsCheck` 버전 핀. **`js/ui.js` · `css/style.css` · 엔진 무변경.**
- **권위별 측정 대상**(전부 현재 유효 형상):
  | 행 | A ↔ B | 권위 | 판정 기준(출처) |
  |---|---|---|---|
  | 앞 옆선 ↔ 뒤 옆선 | 명시 side-seam 구간 합(연장 포함) | `designLineTool.sideSeamLabels` → `bodiceCheckpoint.measureSideSeam(effectiveOutline)` · 상태 = `BC.check().sideSeam` | BC 0.1 일치 / 0.3 초과 불일치 · 옆선 의도 = «의도된 이즈» |
  | 앞 어깨 ↔ 뒤 어깨 | `edge:"shoulder"` 구간 합 — 다트 다리 제외 = 다트 닫은 길이 | `BC.effectiveOutline` + `BC.sideSeamSegLen` | **없음**(뒤어깨 이세 허용량 미확정) — 차이·방향만 |
  | 앞/뒤/합계 진동 ↔ 소매산 | 진동 = 소매산 − 이세 | `sleeveCheckpoint.check()` 의 `capLengths`·`ease`(완료 판정과 같은 실측) | **없음** — 양수 = «이즈·셔링분»(파랑) · 음수 = «차이 있음» |
  | 소매구 ↔ 커프스(소매 Ⓐ 커프스 있을 때만) | 소맷부리 실측 ↔ 커프스 달림 길이 · 셔링분 | `working.sleeveA.cuff.lengths`(`designCuff`) | 셔링분 = 의도(«셔링») |
  | 목둘레 ↔ 밴드 달림선 | 반쪽(CB~CF) · 여밈분/밴드 앞 끝 연장 제외 | `BC.check().neckline.half` ↔ 밴드 outline `part:"neck-seam"` 실측 | **없음** — 차이만 |
  | 밴드 윗선 ↔ 위 칼라 이음선 | 반쪽 · 연장 제외 | 밴드 outline `part:"top"` 실측 ↔ 위 칼라 outline `part:"attach"` 실측(표시 없을 때만 `body.attachLenCm` 기록값 · 그 사실을 상세에 적음) | `collarCheckpoint` 0.01 |
- **상태(색 + 글자)**: 일치(녹) · 차이 있음(황) · 이즈/셔링(파랑) · 미측정(회) · 변경됨(보라). 빨강 오류 없음. 기준 없는 행의 «일치» = 표시 0.00(|차| < 0.005 — 반올림이지 공차 아님).
- **미측정/변경됨(값을 싣지 않는다 · 0·원본 대체 없음)**: 소매 파생 몸판·요크/프린세스/페플럼 분리 몸판의 옆선·어깨 · **소매 Ⓡ~Ⓩ 의 진동 ↔ 소매산**(check 숫자의 의미를 1차에서 확인 못 함 — blockedBy: 종류별 «무엇과 무엇이 붙는가» 정의) ·
  **M 계열(밴드+위 칼라 `shirt-two-piece`) 밖의 카라**(blockedBy: 종류별 달림선/목표값 의미 — `neckTargetCm` 은 메타 목표라 실측처럼 싣지 않음) · 위 칼라 미적용 · 몸판 완료 전.
  몸판이 완료 뒤 바뀌면 소매·목둘레 행 = «변경됨»(옛 숫자 없음), 카라가 옛 몸판 hash 기준이어도 같다.
- **갱신**: `updateDesignResultUI` 가 매번 다시 쓰는 `#designResultCheckNote` 를 MutationObserver 로 받아(글자는 읽지 않음) trailing 150ms 한 번 · 끌기 중(`isEditDragging`)에는 미룸 · 같은 HTML 이면 다시 안 그림. render 프레임 계산 없음.
- **실측(격리 `127.0.0.1:8420` · storage 0키 → 0키)**: 박시 A + 여밈 1.2/안단 1.2 → 소매 Ⓐ → 카라 M + 본체 → 직접 수정 전환 → 카라·Design 완료 = 옆선 37.38/37.38 · 어깨 12.28/12.28(뒤 2구간) ·
  진동/소매산 20.63/21.47 · 21.59/22.85 · 42.21/44.32(+2.11) · 목둘레/밴드 18.82/18.82 · 밴드 윗선/위 칼라 18.35/18.35. 여밈 제거(완료 뒤 변경) → «일치 3 · 변경됨 4» → 프로젝트 저장·열기(메모리 왕복) → 원래 수치 복귀.
  커프스 = 20.00/32.07 셔링분 12.07. 퍼프 Ⓙ = +10.99 «이즈·셔링분». Ⓡ·Ⓣ·Ⓥ = 옆선·어깨·진동 행 미측정 + 사유. 계산 전후 geometry sha·완료본 hash 4개 동일. 390×844 · 320×640 = 수평 넘침 0.
- **Codex 리뷰 보완(같은 날)**
  - **실제 엔진 통합 검사** `seamMatchIntegrationCheck`(stub 없음 · 실제 blockWorkflow → designBodice → designPlacket → checkpoint 3종 → 소매 Ⓐ·designCuff → `collarPresets.composeDraft` M → designResult → projectFile + seamMatch):
    카드 수치 = `measureSideSeam`·`check.sideSeam`·완료본 `cap.lengths/ease`·`sewnArmholeLengths`·`necklineLengths.half`·카라 `measure` **그리고 200샘플 독립 점열 실측** ·
    계산 3회 뒤 프로젝트 그래프·완료본 hash 4개 바이트 동일 · 여밈 제거 → 소매/목둘레 «변경됨»(옛 숫자 없음) → 재완료·재적용 → 현재 값 · 커프스 = `designCuff` 기록 = 소맷부리 독립 실측 · 저장 → 빈 세션 열기 → 모델 바이트 동일.
  - **어깨 정의 검증**: 원형 뒤 어깨는 외곽이 다트 입구에서 끊기고(다리는 construction) 두 `shoulder` 구간이 다리 2개로 같은 꼭짓점에 이어진다 → 구간 합 = 다트 닫은 봉제 길이(통합 검사로 고정).
    **실제 마우스로 뒤 어깨 다트를 진동으로 옮긴 원형**(절개 클릭 → 조각 선택 → 핸들 더블클릭 끝까지 → 적용 → 원형 완료 → 디자인): 어깨 구간 4.475 + 7.805 = 12.280(이동 전과 같음 · 강체 회전) ·
    닫힌 옛 다트 입구에 0.10cm 단차(다리 9.083 / 8.980 — CLAUDE.md 의 «뒤판 잔여 sliver · 패턴 확정 단계 흡수»)가 남는다 → 카드는 그 단차를 어깨 길이에 넣지 않고 상세에 그 사실을 적는다. 정의 유지(미측정 전환 불필요).
  - **카라 M 곡선 실제 조작**(1300×850 · 실제 마우스): «본체 직접 수정» → 바깥선 클릭(선택) → «곡선으로» 클릭 → 핸들 점 끌기(끝점 이동 없음 · 형상 변경 확인) → `#designResultCheckNote` 갱신 신호 각 1회(갱신 누락 없음) ·
    카라 = «변경됨 · 다시 완료 필요», 카드 = 현재 형상 그대로 측정(이음선 잠금 → 18.35/18.35 일치 유지 · 바깥선은 맞춤 대상 아님) → 카라·Design 재완료 → 같은 수치. storage 0키.
  - **런타임 보완 3건**: 위 칼라 이음선을 기록값이 아니라 **현재 위 칼라 형상의 attach 구간 실측**으로 · 소매 없음 사유를 내부 코드(`no-sleeve`) 대신 글로 · 어깨 상세에 다트 단차 미포함 문구.
- **한계**: 실제 터치 미검증 · 앞 가슴 다트를 어깨로 옮긴 몸판(앞 어깨 2구간)은 따로 실측하지 않았다(같은 강체 절개 원리 · 뒤판으로 확인) · 다트를 진동으로 옮긴 원형에서는 소매 Ⓐ 가 적용되지 않아 그 조합의 진동 행은 «소매 없음» ·
  빠른 도구 막대와의 겹침은 카드가 시트 안이라 앞 절 실측(막대 ↔ 시트)에 의존 · 전체 runAll 은 보완 전 통과분 재사용(보완 뒤에는 seamMatch 2종 + appleUiCheck 만 재실행).

~~~~

~~~~markdown
## 지금 서 있는 곳

| 단계 | 상태 |
|---|---|
| ① 원형(draft) | **완료** — 치수·다트이동·곡선 편집·`원형 완료` 세션 스냅샷(`blockWorkflow`) |
| ② Design 몸판 | **완료** — 여유량·길이·옆선·곡선화·네크라인·앞여밈·허리 다트 재배분·목표 완성 허리 + `bodiceResult` |
| ③ Design 소매 | **완료** — 하부 실루엣·위팔/소매산·직접 편집 + `sleeveResult` |
| ③ Design 소매 — 소매 Ⓐ(P.137–139, 스트레이트) | **완료·Design 통합 연결** — `designSleeveA` 엔진 + `sleevePresets`(`bunka-sleeve-A`) + `sleeveAApply`. 소매 탭 «소매 라인»에서 적용 → «소매 모양 완료» 가 `sleeveResult` 에 **`origin`(preset·method bodice-armhole·P.137) · `inputs`(소매길이) · `meta`(AH·소매산·폭·목표/실제 이세) · 불변 geometry** 를 담는다(기본 소매 전용 `parameters` 는 없음 · 공통 `cap.lengths/ease/splitPoint` 는 geometry 실측 — **재단·물리 검증의 권위값은 이 `cap.ease`**, `meta.easeTarget/easeAfter` 는 엔진 기록(샘플링 차 ~0.001cm, 맞추지 않음)). 게이트 = 기본 소매 게이트 + 차단 아님·출처 hash·현재 geometry 가 Ⓐ 재제도와 일치. 카라·`designResult` 로 그대로 이어지고 기본↔Ⓐ 전환·몸판 변경은 «변경됨/무효 → 재완료». 기본 소매 완료본은 byte-equivalent. 회귀: `sleeveAResultCheck.js` |
| ③ Design 소매 — 소매 Ⓑ(P.41, 타이트) | **완료·Design 통합 연결(2026-10-06)** — `designSleeveB`(Ⓐ 읽기 전용 → 소맷부리 W×3/4, 앞뒤 반폭 중점 절개 강체 닫힘 → 소매산 P 주변 Hermite·소맷부리 자연 Hermite 로 정리한 **한 조각 outline**; raw rigid 는 `meta.rigid` 감사용) + `sleevePresets`(`bunka-sleeve-B`, 타이트 소매 라인) + `sleeveBApply`(`working.sleeveB` · 출발 Ⓐ 는 같은 몸판·소매길이로 내부 제도 · Ⓐ/Ⓑ 배타). 소매 탭 «소매 라인»에서 적용 · 입력 = 소매길이 + 선택 손바닥 둘레(비면 W×3/4, 소맷부리 < 손바닥+3cm 는 **경고만·자동 보정 없음**). «소매 모양 완료» 가 `sleeveResult` 에 `origin`(P.41) · `inputs` · `sourceSleeveAHash` · `meta` · 불변 geometry 를 담고 카라·`designResult` 로 Ⓐ 와 같이 이어진다. **지배 ease = `cap.ease`(fairing 된 최종 geometry 실측)**, `meta.easeTarget/easeAfter` 는 감사 정보. 편차 한계 0.46 등은 **책 수치가 아닌 sweep 실측 검증 공차**([노트](book/P041.md)). 회귀: `designSleeveBCheck`(111, 1344 sweep ≈50s) · `sleeveBUICheck` · `sleeveBResultCheck`. 다음: Ⓒ UI·프리셋·체크포인트 연결(아래 행) |
| ③ Design 소매 — 소매 Ⓒ(P.41 하단, 뒤 소맷부리 다트) | **재구현·연결 + 마무리(소맷부리 곡선·앞 EL→소매구 맞댐선·연장 영역 표시) 완료(2026-10-09, Codex 검증 대기, 미커밋¹)** — 새 `designSleeveC`(완성 가정선 → 뒤 ◎ EL 맞댐·아래 V → 앞 ◎ → 앞 EL 절개·●◎ → 겹친 만큼 소매구 연장 → 소매산 꺾임 양쪽 ℓ2 국소 재제도 → 독립 실측) + Apply·Annotation·프리셋 문구·캐시. 회귀 `designSleeveCCheck` 64(입력 sweep 450/450) · `sleeveCUICheck` 98 · `sleeveCResultCheck` 89 · `sleeveAnnotationCheck` 278. 남은 한계: 옆선 앞−뒤 잔차(흰 도해 차, B83 0.004) · 소맷부리 곡선 실측 24.049(목표 24.050) · 앞 옆선 무릎(EL 절개 겹침, ≈2.3°) 유지 · 소매산·소맷부리 G1(곡률 연속 아님) · ℓ2 임시. **아래 «⚠…» 이하는 2026-10-08 오전까지의 이력.** 현행 해석(확정 공정·방법 교훈·대체된 가정·미확정)은 **[book/P041.md § Ⓒ 재해석](book/P041.md)**이 소유한다. 2026-10-08 최신 확정: 소매산은 Ⓐ 가 출발이고 맞댄 뒤 조금 찌그러진 것을 자연스럽게 이어 다시 그린다(Ⓐ 완전 고정 아님). 소매산 재제도 구간 ℓ=2cm — 김님 시안 평가 «좋음», **우선 유지·적용**(책 치수·최종 고정값 아님). 뒤 다리끝 = Ⓐ 밑단 교점에서 수직 아래 1cm(확정). 앞 교차·∅ 는 확정 조건으로 유일 결정됨. 뒤 EL 쐐기(■) = 김님 확정 도식(Q=뒤 절개축×EL, R=P_b→오른쪽 새 다리끝 직선×EL, D=QR, E/F=Q∓D/2 — D-259). 미확정: 재제도 구간 최종값·규칙 · 뒤 다리끝 ‘1’ 하강 의미·●의 측정 방향(뒤 ■·∅ 는 P041.md 에 조건부 유도됨). 아래는 **2026-10-07 배포 구현의 기록**(1.49 계산 겹침·최종 호 길이 1:2:1 강제·앞 바깥 전체 회전+fairing 은 대체된 가정): 엔진 `designSleeveC`(Ⓐ 읽기 전용 → 소맷부리 W×3/4, **실제 윤곽(최종 곡선) 호 길이 구간 ●:2●:● = 6.012:12.025:6.012**, EL 위 반폭 중점·EL 아래 1:2:1 경계, 앞 겹침 치수별 계산(B83 1.49), 앞 바깥 조각 절개축 위 끝 중심 강체 회전, 뒤 열린 다트(다리 길이 같음·닫힘 정합), 소매산 P_f·소맷부리 이음 G1 정리 — raw 는 `meta.rigid` 감사용) + `sleevePresets`(`bunka-sleeve-C`, 타이트 소매 라인) + `sleeveCApply`(`working.sleeveC` · 출발 Ⓐ 는 같은 몸판·소매길이로 내부 제도 · 기본/Ⓐ/Ⓑ/Ⓒ 배타). 소매 탭 «소매 라인»에서 적용 · 입력 = 소매길이 + **팔꿈치 길이 EL(cm, 기본 31.4)** — 빈 값·범위(10–60) 밖·엔진 지원 범위 오류는 이해되는 문구로 거부하고, **Ⓒ 가 켜져 있으면 차단 표시(완료 불가)로 남겨 이전 정상 형상을 현재 입력의 결과처럼 쓰지 않는다**. 표시 줄 = 소맷부리 목표/실제(호 길이)·구간 뒤:중앙:앞·EL·뒤 다트(폭·다리)·앞 겹침(계산)·AH/소매산/**이세(geometry 실측)**. «소매 모양 완료» 가 `sleeveResult` 에 `origin`(P.41) · `inputs`(소매길이·EL) · `sourceSleeveAHash` · `meta` · 불변 geometry 를 담고 카라·`designResult` 로 이어진다(**지배 ease = `cap.ease`**). 입력(EL·소매길이)·몸판 변경은 «변경됨/무효 → 재완료». 회귀: `designSleeveCCheck`(63) · `sleeveCUICheck`(97) · `sleeveCResultCheck`(89) · 기본/Ⓐ/Ⓑ 완료본 byte-equivalent. **제작 정보 표시(2026-10-07, 소매 Ⓐ/Ⓑ/Ⓒ 공통, `js/sleeveAnnotation.js` → `render.js` 오버레이 — 표시 전용·geometry/완료본/hash 불변)**: 캔버스에 패턴명·앞/뒤·SP/소매 중심·위팔(소매폭)·소매산 높이 기준선·소매길이 치수선·앞뒤 소매산 길이/AH/실제 이세(geometry 실측)를 표시하고, Ⓑ 는 소맷부리 목표 W×3/4·실측·절개축·맞댐, Ⓒ 는 EL(현재값+기본 31.4)·뒤 열린 다트 꼭짓점/두 다리 길이/폭·소맷부리 ●:2●:● 구간(최종 호 길이)·앞 겹침(계산값, 음영). 설명용은 청록 점선/가는 치수선/음영, 재단 외곽은 남색 실선(소매 라인 construction 도 청록 점선 — 닫힌 과거 절개선·겹침 영역을 재단선처럼 그리지 않음). 기본 소매는 모델 없음(기존 표시). 토글 «제작 정보 표시»(기본 켜짐, 소매 라인일 때만). 회귀 `sleeveAnnotationCheck`(276, 라벨·치수 = 독립 실측·EL/라인/몸판 변경 동기화·글자 겹침). **화면 맞춤·배치 개선(2026-10-08, 표시·뷰포트만)**: «화면 초기화» fit 이 제작 정보 영역(제목·치수·리더선)을 포함해 계산(`sleeveAnnotation.overhang` → `designLayout.withSleeveOverhang`, 토글 OFF·기본 소매는 추가 여백 0 = 기존 fit 동일), 라벨은 화면 px 기준 배치(우선순위·후보 위치 이동·리더선·번호 표시+범례 폴백, 정보는 생략하지 않음). 한계: 줌아웃이 매우 작으면 글자가 물리적으로 겹칠 수 있어 이때는 번호+범례로 모으고 확대하면 제자리 표시. 도해 대조·의도된 모서리 곡률화(별도 승인) 남음 — [노트](book/P041.md) |
| ③ Design 소매 — 소매 Ⓓ(P.42 플레어, 절개 2개) | **구현·연결 완료(2026-10-09, 커밋 `316ce4b`)** — `designSleeveD`(Ⓐ 읽기 전용 → 앞·뒤 반폭 중점 절개 2개 · 중앙 고정 · 옆 조각을 소매산 기준점 중심 강체 회전, 각 절개 ∅/2 = 소매폭×0.25 · 소매산 기준점 꺾임 국소 재제도 · 소맷부리 6 끝점 통과 곡선) + `sleeveDApply` · 프리셋 `bunka-sleeve-D` · 완료본(`sleeveCheckpoint` checkD/completeD) · 제작 정보. 회귀 `designSleeveDCheck` 38(sweep 126/126) · `sleeveDUICheck` 40. 잠정값(책 수치 아님): 벌림 거리 = 두 밑단 끝점 현 · 소매산 재제도 ℓ 2cm 시작·내부 S 면 0.25 축소(최소 1) · 소맷부리 Hermite. Ⓔ(절개 3개)는 커밋 `0abfeb4`(push 완료, Codex 재검증 관련 828 통과) — [노트](book/P042.md) |
| ③ Design 소매 — 소매 Ⓕ(P.43 턱 소매) | **구현·연결 완료(2026-10-10, 커밋 `ff90e24` · Codex 직접 관련 544 통과 · 김님 Safari 확인)** — `designSleeveF`(Ⓐ 읽기 전용 → 중심 ±1·±3cm 평행 절개 4개 · 가운데 띠 고정 · 소맷부리 기준점 강체 벌림, 각 턱 기본 1.5·최대 3cm · 턱 접은 상태 = Ⓐ 소매산 → 펼친 재단선은 쐐기 위 산 모양) + `sleeveFApply` · 프리셋 `bunka-sleeve-F` · 완료본(`cap.lengths` = 턱 접은 길이, `cutLengths` = 재단선, 이세 = 턱 접은 길이 − AH) · 제작 정보 · 소맷부리 = 기준점·양 끝 통과 자연 곡선(김님 승인, Ⓐ 대비 +0.0004cm 표시 — raw 강체 직선은 감사용). 회귀 `designSleeveFCheck` 63(sweep 162/162) · `sleeveFUICheck` 41. 턱 방향(김님 원문 «바깥쪽으로 접는데 소매중심이 위로 올라와야해») = 접는 선이 중심 쪽 변·중심 쪽 천이 위층. 박기 끝 미확정(만들지 않음) — [노트](book/P043.md) |
| ④ Design 카라 | **완료** — 셔츠 칼라 스탠드·본체·직접 편집·교재 M형 기본형 + `collarResult` |
| ⑤ Design 통합 | **완료** — `designResult`(세 완료본 + 절개선) |
| ③→⑤ 소매 Ⓐ~Ⓩ 통합 점검(2026-11-04) | **26종 같은 조건(몸판 Ⓐ · 각 기본값) 적용 → 소매 완료 → 카라 → `designResult` 전부 통과** · Ⓡ~Ⓩ 파생 몸판은 `sleeve.derivedBodice` 소유(`designResult.bodice` = 원래 몸판) · 무효화·전환·몸판 경계(Ⓐ~Ⓠ ↔ 변형 몸판 · Ⓡ~Ⓩ = Ⓐ 만 `bodice-not-a`) · 회귀 `sleeveIntegrationCheck` · **확정·구현(김님 승인 2026-11-04)**: 재단이 읽을 현재 몸판 = `designResult.finalBodiceOf`(파생 몸판 ∥ `bodiceResult` · 복제 없음) · 절개선은 그 최종 몸판에서 재검증 — 원래에서만 유효하면 사유 있는 완료 거부(`cut-invalid-on-final-bodice`), 작성 중 선은 기존대로 제외 · 보완: 계열 전환 뒤 적용 실패 안내(실제 기호 · 완료 대상) · 작은 창 카라 자리 회피 · **편집 판정 = 최종 판정(김님 승인 2026-11-04)**: 몸판 탭 절개선 snap·상태·분리 버튼이 같은 최종 몸판을 본다(`designLineTool.editBodiceRef` — 원래 맥락은 종전 그대로 · 파생 = frozen 파생 몸판 · 미완료/변경/차단 = «판정 보류» + 재완료 이유) · 파트 분리는 원래 몸판 전용이라 파생 맥락에서 비활성 · 회귀 `cutEditFinalBodiceCheck` · **그리기 완료 → 자동 선택(2026-11-05 김님 실사용 피드백)**: Enter/더블클릭으로 완료하면 방금 그린 선이 선택·편집 상태(역할 버튼 활성 · 기본 guide 그대로) — «선택·편집 → 같은 선 재클릭» 제거 · 다음 선은 «선·곡선 그리기» · 한 점·Esc 는 완료·선택 없음 · **«그리기 완료» 버튼(2026-11-05 김님 «더블클릭하면 불편한데» · 미커밋)**: 도구 줄 «그리기 완료» 한 번 클릭 = 주 완료 경로(Enter·더블클릭 호환 · 같은 `commitDraft`) · 실제로 길이 0 인 선만 완료 불가(같은 자리 두 앵커라도 핸들 있는 곡선은 완료) · 그리기 중 버튼 문구 «그리기 취소» · **Ⓡ~Ⓩ 파생 몸판 연장부 클릭 영역 해결**(hit = 화면 파생 몸판 범위 · `render.js _appendDesignHitLayer` — 수동으로 피스를 붙였을 때 rect 겹침 규칙은 종전 그대로) · 회귀 `lineAutoSelectCheck` · **«선 가까이» 빠른 도구막대(2026-11-05 김님 시안 승인 · 미커밋 · Codex 검토 대기)**: 그리기 중 마지막 점 옆 «그리기 취소 · 그리기 완료» · 완료 직후/기존 선 선택 시 그 선 옆 절개선·외곽·보조선(현재 역할 강조 · 관리선 잠금) — 기존 명령(`finishDraw`·`cancel`·`setRole`) 공용 · 오른쪽 버튼·단축키 그대로 · 위치 = 그려진 SVG 기준(줌·팬·파생 몸판 정합 · 드래그 중 숨김) · `js/designLineQuickBar.js` · 회귀 `lineQuickBarCheck` · 범위 밖: 큰 설정 왼쪽 이동·전체 재배치·점 편집 메뉴 · **막대에서 절개선 → «파트 분리»(2026-11-05 김님 요청 · 미커밋 · Codex 검토 대기)**: 절개선일 때만 별도 다음 단계 행 · 오른쪽 «파트 분리»와 같은 판정(`getSplitState` = `syncSplitButton` 판정 재사용 · 재판정 없음)·같은 명령(`doSplit`) · 불가 = 비활성 + 보이는 이유(무효 · 최종 몸판 미확정 · 파생 몸판 미지원) · 파생 몸판 파트 분리는 여전히 미지원 · **소매 파트 분리(2026-11-05 김님 승인 · 미커밋 · Codex 검토 대기)**: 같은 팝업·오른쪽 버튼·`doSplit` — 분리 기준 = 현재 몸판·입력과 일치하고 화면과 바이트 같은 `sleeveResult`(미완료·변경·차단 = 재완료 이유) · 엔진 `js/sleeveSplit.js`(몸판 `splitRingByCut` 재사용 · 소매 외곽만으로 닫힌 고리 · 열린 V 유지 · 봉합 없음) · «유효 절개선» ≠ «분리 가능»(실제 분할 시험) · 파트 출처 결속(소매/몸판 hash·기호·절개선 서명)·낡으면 숨김/제거 · Design hash 무관 · 기본+Ⓐ~Ⓧ 분리 · Ⓨ·Ⓩ «별도 소매 조각 없음» · 회귀 `sleevePartSplitCheck` · 좁은 화면 분리 결과 = 빈자리가 없을 때만 소형 상태줄 «분리됨 · 파트 N개» + «도구»(Codex 후속 · 터치 «×» 44×44) · **막대 «외곽» → «외곽 대체 미리보기»(2026-11-06 김님 요청 · 미커밋 · Codex 검토 대기)**: 외곽일 때만 별도 다음 단계 행 · 오른쪽 버튼과 같은 판정(`getBoundaryState` = `syncBoundaryStatus` 판정 · 매 render 재판정 없음)·같은 명령(`doBoundaryPreview`) · 원래 몸판 = 종전 `replaceArcOnRing` 결과 그대로 · 소매 Ⓡ~Ⓩ 파생 몸판 맥락의 앞·뒤판 = 사유 있는 거부(원래 외곽을 대체해 현재 결과처럼 보이지 않게) · 소매(기본+Ⓐ~Ⓧ) = 분리와 같은 현재 소매 완료본 고리(`sleeveSplit.boundarySleeve`) — 열린 V(Ⓒ·Ⓦ)는 실제 외곽(품거나 다리 위 끝점이면 거부 · 유지 구간 V 그대로) · Ⓥ 같은 조각만 · Ⓨ·Ⓩ «별도 소매 조각 없음» · 미리보기 출처 결속(선·작업 외곽·소매/몸판 hash)·낡으면 숨김/제거 · 미리보기일 뿐(sleeveResult·Design hash·저장·출력 무관 — 반영은 아래 «외곽 반영» 명시 클릭만) · 좁은 화면 = 소형 상태줄 «외곽 대체 미리보기 표시 중» · 회귀 `boundaryPreviewCheck` · **소매 «외곽 반영»(2026-11-06 김님 승인 · 미커밋 · Codex 검토 대기)**: 미리보기 확인 → 막대·오른쪽 «외곽 반영»(같은 `doBoundaryApply`) → «소매 변경됨 · 다시 완료» → 재완료 · 엔진 `js/sleeveOutlineEdit.js` · 소유 `working.sleeveEdit`(편집 전 frozen 완료본 base + 반영 기록 + 현재 형상 = 화면 한 벌) · 프리셋 재제도 검사 무변경(base 에 그대로 적용) + 수정 분기(기록 재적용 = 화면 형상 · 소매산·이세 = 완료와 같은 측정 함수로 실측 · SP 그대로) · 수정 완료본 `manualEdit`(hash 서명 `me` — 미편집 27종 hash HEAD 와 동일) · 반영 가능 = 대체 구간 의미 하나(소매산 SP 한쪽·옆선·소맷부리·중심 솔기) · 걸침/SP 지남/턱·파생 몸판 소매산·래글런·덧천 = 사유 + 필요한 최소 선택 · 실패 원자성 · 절개선 새 외곽 재검증(남김·이유) · 파트·미리보기 무효화 · 프리셋·입력·몸판 재적용 = 편집 해제(승계 없음 · 안내) · «반영 되돌리기»(마지막 하나) · 소매 탭 현재 실측 vs «제도 기록» 구분 · 캔버스 프리셋 제도 표시 숨김 · **새 소맷부리(2026-11-06 김님 실사용 «미리보기는 되는데 반영 안 됨» → 원리 확정 «양쪽 옆선을 잇는 선 = 새 소맷부리 · 아래 잘라냄»)**: 걸침 중 앞·뒤 옆선 + 소맷부리 구성만(양끝 = 같은 조각 앞·뒤 옆선 · 원래 소맷부리 전부 대체 · 소매산 쪽 전부 유지 · 양쪽 옆선 남음) — 새 선 = hem · 옆선 = 잘린 길이 · 그 밖의 걸침은 종전 거부 · 회귀 `sleeveOutlineEditCheck` §9 · [감사 기록](sleeve-integration-audit.md) §7-반영-소맷부리 · **첫 완료 없는 수정(2026-11-06 김님 승인 UX · 미커밋 · Codex 검토 대기)**: 흐름 = «라인 적용 → 선 그리기 → 미리보기 → 외곽 반영(필요한 만큼) → «소매 모양 완료» 한 번» · 내부 수정 기준 `sleeveCheckpoint.editBase`(그림자 working 에서 같은 `complete` = 같은 check·build·hash · `completedAt` 없음 · 저장 안 함 — 출처에서 매번 다시 만듦) · 현재 형상 하나 `currentShape`(미편집 = 내부 기준 · 수정 중 = `checkEdit` 통과 형상 · hash = 지금 완료하면 나올 완료본 hash → 완료 전후 파트·미리보기 결속 유지) · `sleeveSplit.sleeveRef` 는 더 이상 `sleeveResult` 를 요구하지 않음(몸판 완료 요구는 그대로) · `quickRef` = 마지막 전체 판정의 출처 키 캐시(WeakMap · 상태 객체·수정 기록·몸판 hash·화면 outline — render 마다 재제도 없음) · 연속 반영·되돌리기 중간 완료 없음 · 완료 전 Design = «소매 없음» 거부 · 이전 완료본 보존 + «변경됨» · 이 항목이 위 «완료본 기준 · 재완료 필요» 기술을 대체 · 회귀 `sleeveOutlineEditCheck` §10 · [감사 기록](sleeve-integration-audit.md) §7-첫완료없음 · **판단 필요 없음** · 남은 일: 파생 몸판 스키마 통일 · 파생 몸판 파트 분리(스키마 통일 뒤) — [감사 기록](sleeve-integration-audit.md) §7·§8 |
| 처리 방법 161 | **완료** — `designFlare` + 밑단 곡선 이음 + 플레어 Ⓖ·Ⓗ 프리셋·UI(`slashSpread` = Ⓖ 위 P.163 기준점 절개) |
| 처리 방법 158 | **완료·Ⓝ 에 연결** — `designJoin.buttSpread`(맞대고 → 허리 입 점 고정 → 밑단 끝 벌림 → G1 밑단 이음). 범용 UI 는 없다(Ⓝ 경로만) |
| 처리 방법 157 | **완료·Ⓜ 에 연결** — `designJoin.buttJoin` + `designWaistSeam.split`(허리 이음선 Ⓜ). 범용 맞댐 UI 는 **만들지 않았다**(Ⓜ 라인 적용 경로만) |
| 처리 방법 163 | **Ⓞ·Ⓟ 에 연결** — 다트 없는 몸판의 WL(Ⓟ는 WL−5 이음선) 등분 수직 절개 + `buttSpread` 순차 + 이음선 fairing |
| ⑥ 재단(파트·시접·너치) | **1단계 완료(2026-11-13 · 미커밋)** — 유효 `designResult` → 읽기 전용 재단 조각 목록·외곽(시접 전). 시접·너치·식서·수량·배치는 미착수(아래 «재단 준비 1단계») |
| ⑦ 출력(PDF·DXF) | **일부** — 재단 결과 A4 실물 인쇄(`cutPrint`) · 재단 DXF(`cutDxf` · 일반 R12 · CAD 호환 미검증) |

¹ **git 대조(2026-11-04, HEAD `0672ee5`)**: 아래 소매 항목의 «미커밋» 은 기록 당시 상태다 — **소매 Ⓐ~Ⓩ 26종의 엔진·적용·UI 는 전부 커밋돼 있다**(소매별 커밋 = [감사 기록 §2](sleeve-integration-audit.md)). 지금 미커밋은 통합 점검 파일(`test/harness/sleeveIntegrationCheck.js` · `runAll` 등록 · 이 문서·감사 기록), 승인 후 보완(`js/designResult.js` · `js/ui.js` · `js/sleeveAnnotation.js` · `index.html` 캐시 버전 · 캐시 버전 단언 27개 검사), 기존 `docs/TESTING.md` 로컬 수정이다.

**세션 전용 + 프로젝트 파일(2026-11-09)**: 완료본은 메모리에만 있고 reload 하면 사라진다 — 단, **디자인 프로젝트는 파일 메뉴 «프로젝트 저장/열기»로 JSON 한 파일에 담아 이어갈 수 있다**(아래 절). 자동 저장·클라우드·계정 없음.

~~~~

~~~~markdown
## 프로젝트 저장·열기 (2026-11-09 김님 승인 · 미커밋 · Codex 검토 대기)

- **범위(v1)**: 원형 완료 → «디자인 시작» 뒤의 **디자인 프로젝트 전체** = 출발 원형 완료본(blockWorkflow 레코드: snapshot·canonicalHash·version) + `designProject` 전부(sourceBlock·baseSource·referenceGeometry·`working` 의 모든 키 — geometry·parameters·patternLines(곡선 포함)·designOutline·layout(배치·placement)·parts·boundaryPreview·sleeveEdit·각 프리셋 상태·bodice/sleeve/collar/designResult 완료본) + 화면 단계(원형/디자인 · 몸판/소매/카라 탭). **미지원(정직 표시)**: 원형 편집 화면(치수 입력·진동선 곡선·다트 이동 — 기존 «데이터 내보내기» 곡선 JSON 의 몫) · 디자인 없이 원형만 저장(버튼 비활성 + 이유) · «적용» 안 한 입력칸 값.
- **파일**: `pattern-project_B83-W64-BL38_YYYYMMDD-HHMM.json` = `{format:"bunka-pattern-editor.project", schemaVersion:1, savedAt, integrity:{algorithm:"sha256", payload}, payload:{graph, ui, status, summary}}` · 곡선 JSON(`armhole_data_*.json`, 배열)과 이름·형식 모두 구분(곡선 파일을 열면 «데이터 가져오기로 여세요»).
- **graph = 충실 인코딩**(`js/projectFile.js`): NaN/±Infinity/함수/Map 등 = **저장 거부(경로 표시)** · undefined 속성·-0 = 경로 목록으로 그대로 · 공유 참조(예: designResult.bodice === bodiceResult)·순환 = alias · Object.freeze = deep/shallow 경로 목록 → 열 때 같은 동결.
- **열기 순서**: 파일 읽기 → JSON → format/schemaVersion → 금지 키(`__proto__`·constructor·prototype)·유한수 → sha256 → graph 복원 → 원형 완료본 canonical 재계산(`blockWorkflow.verifyCompleted`) → project 키·출처 정합(sourceBlock·baseSource·referenceGeometry = 완료본) → 동결 불변식 → **완료/변경됨 재계산**(기존 `isCurrent*Changed`, `designWorkflow.evaluateIsolated` — 후보를 동기적으로만 잠깐 current 로) = 저장 시점과 같아야 함 → 재인코딩 = 파일(판정 무부작용) → (현재 작업이 있으면) «교체하고 열기/취소» → **교체 트랜잭션**(`projectFile.commitCandidate`): ① 화면 상태 캡처(`projectSessionUI.capture` — 단계·도구·서브탭·미적용 라인 선택·자동 입력 기록·선 도구 모드·디자인 패널 입력칸 값·네크라인 카드·카메라) ② `blockWorkflow.adoptRestored` ③ `designWorkflow.adoptRestored`(둘 다 되돌리기 함수 반환 — 이전 project 가 null 이어도 같은 객체로) ④ `afterRestore`(값 초기화 → 단계·탭·갱신·render → 선 도구 off 는 마지막). ③·④ 에서 throw = 역순 되돌림(project·원형 레코드·화면 상태) 후 `ui-restore-failed`(화면 복원까지 실패하면 `uiRolledBack:false` + «먼저 프로젝트 저장» 안내). 화면 갱신이 후보에 쓴 값은 버려지는 후보에만 남는다. **실패·취소 = 현재 project·원형 완료본·화면·localStorage 0 변경.** 회귀 `projectFileCheck` §7(교체 성공 뒤 afterRestore throw — 기존 project 있음/빈 세션/rollback 자체 실패) + 실제 브라우저 `render` 실패 주입(같은 객체·그래프 바이트 동일·소매 탭·선택 모드·미적용 입력 61·카메라 그대로).
- **저장 전 마무리(조용한 유실 금지)**: 그리는 중 선 · 옆선 길이 맞춤 미리보기 · 몸판 «적용» 전 라인 선택 · 몸판 수치/네크라인/여밈 입력칸 미적용 · 원형 다트/곡선 편집 중 = 저장·열기 거부 + 이유. **한계**: 소매·카라 입력칸의 미적용 값은 감지하지 않는다(파일 메뉴 문구에 «적용하지 않은 입력칸 값 미포함» 명시).
- **design stage 파일 메뉴**: 종전엔 design 에서 파일 메뉴 전체가 숨겨졌다 → 이제 design 에서는 **프로젝트 행만** 보인다(곡선 저장·가져오기·DXF 는 원형 stage 전용 그대로 · `css/style.css`).
- 새 API: `blockWorkflow.verifyCompleted/adoptRestored` · `designWorkflow.evaluateIsolated/adoptRestored` · `window.projectSessionUI`(ui.js: snapshot·unfinished·capture·rollback·afterRestore) · `window.projectFile`. 회귀 `projectFileCheck`(98).
- **관찰(→ 2026-11-10 수정됨, 아래 «다음 후보» 첫 항목)**: ① 아무 조각에든 새 선을 «완료»하면 `invalidateParts` 가 합성 외곽(designOutline)을 지워 곡선 밑단을 반영한 몸판이 «변경됨»이 된다(소매에 선을 그려도) — «디자인 외곽 합성»을 다시 눌러야 복구. ② 그 뒤 소매 선의 «판정 보류 — 몸판이 완료 후 바뀜»이 선을 다시 클릭할 때까지 남는다(캐시된 판정). 수정 소매 흐름에서 실제로 걸린다.
- **검증 구분**: ⓐ 실측함 = 실제 «파일로 저장» 버튼 클릭이 만든 Blob(82,516 B) → BroadcastChannel → 같은 격리 origin 의 **새 탭(새 세션)** 의 실제 `#inpOpenProject` change 핸들러(File.text 경로) · 거부 7종·취소·확인 교체 · 320/390 폭. ⓑ **실측 못 함** = 디스크 다운로드 → OS 파일 선택 창 왕복(내장 브라우저는 Blob 을 디스크에 쓰지 않음 — 저장 패널이 떠 Codex 가 Escape 로 취소, 파일 미기록) · 실제 다른 컴퓨터·다른 브라우저(Safari 등).

~~~~
