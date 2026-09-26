# 테스트·검증 규칙

> 회귀 하네스 사용법과 테스트 전용 장치. 실행 명령은 CLAUDE.md 「개발 서버 / 실행」.

## 헤드리스 회귀 테스트 하네스 (2026-07 신설) — `test/harness/`

**배경**: 지금까지 모든 스트레스 검증(무작위 N런×G세대, maxRatio, selfX/breaks/closed
카운트)은 브라우저 콘솔에서 1회성으로 돌리고 결과만 CLAUDE.md에 남겼다 — 재실행
불가능해서 리팩터링 전후 비교나 회귀 확인이 매번 처음부터 다시였다. 이 하네스는
같은 검증을 **재실행 가능한 Node 스크립트**로 고정한다.

**구조**: Node `vm` 모듈로 `js/draft.js`/`js/state.js`/`js/dartMove.js`를 실제
그대로(재구현 없이) 헤드리스 컨텍스트에 로드하고, DOM은 이 세 파일이 로드/실행 시
건드리는 최소한만 스텁한다(`document.getElementById`가 `inpB/inpW/inpBL` 등 입력
요소만 값을 주고 나머지는 undefined — 실제 코드가 전부 `if(el)`로 가드하므로 안전).
- `loadEngine.js`: vm 컨텍스트를 만들고 세 파일을 실행한 뒤, `applyDartMove`/
  `splitBakedOutline`/`chooseSignedBaseAngle`/`findMaxSafeAngle`/`bakeFromSplitPieces`
  등 실제 프로덕션 함수 바인딩을 그대로 꺼내 온다.
- `dartDriver.js`: `initDartMoveClickHandler`의 클릭 로직을 DOM 이벤트 없이 재현하는
  얇은 오케스트레이션. **판단(각도/충돌/예산)의 실제 계산은 전부 실제 함수 호출**이고
  이 파일은 계산을 재구현하지 않는다. 단, "어떤 함수를 어떤 순서로 부르는지"의
  오케스트레이션은 클릭 핸들러에서 **복제**한 것이라 동기화가 필요하다(파일 상단 ⚠️
  주석 참고 — 다음 리팩터에서 `prepareDartMoveCandidate()` 공용 순수 함수로 추출 예정).
  코어는 `performMove()` 한 곳뿐(무작위·레시피 경로 모두 이걸 거침 — 복제 딱 한 벌).
  - `attemptDartMove(...)`: 무작위 컷(스트레스용).
  - `applyRecipe(side, dims, {type, arcFraction, piece, moveFraction})`: **시맨틱 레시피**로
    컷을 잡는 결정론 경로. 세그먼트 인덱스·절대좌표가 아니라 `type + 연속 구간의 호
    길이 비율`로 위치를 찾는다(`resolveCutRecipe`). 탐색 실패 = 예외(테스트 실패).
- `goldenSnapshot.js`: 결과 형상을 **ε 기반 골든**으로 고정. 폐곡선 시작 인덱스
  정규화(순서·방향 유지), 좌표 1e-4cm 반올림, `type/from/to/disabled`만 보존
  (dartId/timestamp/디버그 필드 제거), notch는 mouth BP 극각순 정렬 + 개수·각도·총합·
  budget 별도 저장. `GoldenFile.check()`/`.save()`, `--update`로만 갱신. bit-for-bit이
  아니라 ε 동등성(좌표 1e-4cm, 각도 0.01°). **회귀망 실증 완료**: 0.01cm/0.5°/notch
  개수 드리프트는 잡고 sub-ε(5e-5cm) 노이즈는 통과.
- `backDeterministic.js` / `backRandomStress.js [runs] [gens]`: 뒤판(아래 참고).
- `frontDeterministic.js [--update "reason"]`: 앞판 결정론 매트릭스 + 골든
  (`golden/front.json`). 첫 다트 풀/부분×A/B(시맨틱 레시피), 중간각 스윕. **60 PASS.**
- `multiDartScenarios.js [--update]`: 앞판 **다중다트 분산 체인**(최고 위험 지점) + 골든
  (`golden/multidart.json`). 2다트·3다트 분산(사용자 레시피: front-waist 50% → side-seam
  40% → front-armhole-upper 100% = 2→3→3 notch, 합=budget), relocate(풀드래그=1다트).
  매 세대 selfX/breaks/closed=0 + 퇴화 sliver 없음 + 합≤budget×1.15. **49 PASS.**
- `frontOldestDartAudit.js [--update]`: 오래된 다트 재이동 **2층 감사** + 골든
  (`golden/oldest_retarget.json`). Layer 1(빠른 위상: split+sourceNotch 귀속만, 171조합)
  = 156/156 재겨냥 가능(영구 동결 없음)·귀속 312/312 일치. Layer 2(대표 10조합 실제
  bake/apply) = source−θ/new+θ 보존. **83 PASS.**
- `nonMonotonicFixture.js`: **케이스 정의 + 독립 oracle의 단일 출처**(모듈, 실행 파일 아님).
  `nonMonotonicIntervals.js`(C0)와 `applicableIntervals.js`(C3)가 공유한다 — 복제하면
  한쪽만 고쳐도 조용히 어긋난다. oracle은 프로덕션을 호출하지 않는다(독립성).
- `applicableIntervals.js`: 프로덕션 ③ `findApplicableIntervals`를 위 oracle·경계 상수와
  대조 + 평가 중복 계측 + 기준선 재사용 동치. **자체 골든 없음**(진실값은 C0 픽스처가
  이미 갖고 있다). **63 PASS.**
- `rotationSignSelection.js`: C4 부호 선택 2층 검증. Layer 1(실기하) = 한쪽만 가능 /
  양쪽 가능 / sourceNotch 단일 부호 / leg-barrier / **비단조에서 위→아래 탐색이 먼 구간을
  찾는지** / 평가 횟수 계약 / exact 반환각 재검증. Layer 2(②·탐색 스텁) = EPS 동률 /
  양쪽 불가 — **현재 도안 기하에서 0건이라 스텁으로만 덮을 수 있는 분기**다. **51 PASS.**
- `signSelectionMigration.js [--stride N] [--verbose]`: legacy 체인 vs 새 선택기 병렬
  대조 + 평가 횟수 집계. `--stride 1`이면 **868조합 전수(108초)**, 러너에선 4로 표본 축소.
  legacy 복제(`legacyChoose`)는 **한시적**이다 — legacy 함수가 삭제될 때 이 파일도 목적을
  다한다. (`prepareDartMoveCandidate`를 legacy 기준으로 쓰면 전환 후 자기 자신과의
  비교가 되어 무의미해지므로 legacy 함수를 직접 부른다.)
- `runAll.js [--update "reason"]`: 전 스위트 일괄 실행(리팩터 전후 비교용).
- 실행: `node test/harness/runAll.js`. 골든 최초 생성/의도적 갱신: `... --update "사유"`.
  **현재 14스위트 / 1,229+ 검사 전부 통과.**

**앞판 회귀 고정 결과 (2026-07)**: 리팩터 착수 전 앞판 다중다트를 결정론적으로 잠갔다.
앞판 old-dart(BP-G-GG)는 **이등변**이라 뒤판과 달리 잔여 sliver가 없어 불변식이 더
엄격하다 — 첫 다트 100% 닫으면 notch 정확히 0개(잔여 없음), 스윕에서 source 감소·new
증가가 합=budget=18.25°로 완벽 보존(예: 10%→[16.42,1.82], 50%→[9.13,9.12]). 골든이
post-normalize 결과를 좌표·각도까지 고정하므로, 리팩터가 불변식을 지키면서 형상을
미세하게 바꾸는 회귀까지 잡는다.

**뒤판(pivot=E) 검증 결과 (2026-07, 최초)**: normalize / 다트 예산 게이트 /
`rotationLegBarrier` / sourceNotch 3차 재설계는 전부 앞/뒤 공용 경로라 뒤판도
함께 타지만, 뒤판 중심 검증은 이번에 처음 실행했다.
- **결정론적 매트릭스 128/128 PASS**: 첫 다트 풀/부분×A/B조각, 중간각
  10/25/50/75/90/100% 스윕, 오래된 다트(원본 back-shoulder-dart 잔여) 재겨냥
  전수조사(24콤보 중 23곳에서 재겨냥 가능 — front와 마찬가지로 latestDartId류
  영구 동결 없음 확인), source−θ/new+θ 보존(오차<0.3°) 전 조합에서 확인.
  MIN_DART_ANGLE_RAD 미만(θ<0.5°)이 되는 두 케이스만 정상 차단(기대된 스킵).
- **무작위 스트레스 60런×10세대(600세대) — selfX/breaks/closed/budget초과 전부 0**,
  maxRatio 항상 정확히 1.0000(front와 동일하게 sourceNotch 기반 각도가 정확히
  예산을 보존). front 40런×8세대도 같은 하네스로 재확인(회귀 없음).
- **알려진 소견(버그 아님, 패턴 시스템 자체의 특성 — 사용자 확인 완료)**: 뒤판
  원본 다트(`back-shoulder-dart`, apex=E, 다리 끝점 `dartCenter`/`dartEnd_`)는
  **이등변이 아니다** — E-dartCenter 반지름 9.083cm vs E-dartEnd_ 반지름 8.980cm
  (실측, ~0.10cm 차이). front의 BP-G-GG는 이등변이라 첫 다트를 100% 닫으면 잔여
  notch가 정확히 0개인데, 뒤판은 각도상 완전히 닫혀도(잔여 각도 ≈0) 두 다리
  반지름이 달라 **~0.103cm 폭의 잔여 sliver 노치가 항상 남는다**(모든 시드에서
  재현, 무작위 노이즈 아님). `EPS_CLOSED_DART=0.05cm`(front 실측 기준)보다 커서
  `normalizeBakedSegments`가 못 지운다.
  **사용자(패턴사) 확인**: "패턴 시스템 자체의 약점"이다 — 실제 작업에서도 뒤판
  다트이동을 끝내면 패턴사가 **뒷옆목점(bSNP)과 뒤어깨점(bSP)을 직선으로 이어
  뒤어깨선을 다시 그리고**, 앞어깨선 길이와 비교해서 맞춘다(블라우스류는 보통
  앞/뒤 어깨 길이를 같게 맞춤 — 뒤어깨가 짧거나 길면 bSP에서 수정). 즉 이 잔여
  틈은 다트이동 자체의 버그가 아니라, **다트이동 다음 단계로 예정된 "뒤어깨선
  재봉선 정리 + 앞/뒤 어깨 길이 맞춤"**이 아직 구현되지 않아서 보이는 것 —
  그 기능이 생기면 bSNP-bSP를 직선으로 재작도하면서 이 sliver는 자연히
  흡수/제거된다. **결론: 코드(EPS_CLOSED_DART, dartCenter/dartEnd_ 공식) 수정
  안 함** — 기록만 남기고, "뒤어깨선 재봉선 정리 + 앞/뒤 어깨 길이 맞춤"을
  향후 별도 기능(다트이동과는 다른 작업 단계)으로 백로그에 남긴다.
## 임시 local curve fixture (테스트 전용)

**목적**: 빈 localStorage 테스트 환경에서도 검증된 곡선으로 UI·다트 기능을 확인하기
위한 장치다. **서비스용 제품 기본 데이터가 아니다.** 구현 커밋 `c9c6b9c`.

**데이터 공개 계약**
- 실제 `armhole_data_2026-07-16.json` 은 **미추적·비공개 유지** — 원격 저장소에 곡선
  좌표를 커밋하지 않는다.
- 새 clone 에는 fixture 가 없으며 **공식 기본값으로 fallback** 한다(콘솔 오류 0).
  테스트 장치마다 JSON 을 프로젝트 루트에 **수동 복사**해야 한다.

**우선순위**
1. 사용자 localStorage exact 저장값
2. optional local fixture 의 exact B-W-BL **마지막** 항목
3. 기존 initHandles/sleeve 공식 기본값
- **유사 치수 적용 금지**(좌표는 도안 절대좌표라 exact key 에만 유효).
- body exact 와 별도로 sleeve 는 기존 **SL·capFormula exact 계약** 유지 — 불일치면
  sleeve 를 억지 적용하지 않는다.

**쓰기 금지**
- fixture 적용은 **state 메모리에만**. localStorage·IndexedDB 쓰기 0,
  saveCount·dirty 불변, save/import/autoSave 호출 금지.
- 단, 사용자가 실제 곡선을 편집하면 기존 autoSave 가 작동하며 **그 순간부터
  사용자 데이터가 된다**(의도된 경계).

**실패 계약**
- 파일 없음(404)·malformed·미등록 치수·flag=false → **콘솔 오류 없이** 기존 공식
  기본값. 로딩 UI·canvas 숨김 없음.
- 사용자 저장값은 fixture 보다 **항상** 우선 — fetch 완료 직전에도 사용자 저장값을
  재확인한다.

**구조 (제거 경계)**
- `js/testSeed.js` **한 파일에 격리** — storage.js 등 기존 원본 파일 무변경.
- `ENABLE_TEST_CURVE_DEFAULTS` 단일 플래그.
- 기존 `loadSavedCurveForCurrentMeasurements` wrapper 는 원본 참조 1회·중복 설치
  방지·**자동 복원 경로에서만** 개입(명시 호출 alert 경로 불개입).
- **서비스 전 제거**: ① `js/testSeed.js` 삭제 ② index.html 의 script 태그와 안내
  주석 삭제 — 이것만으로 기존 동작 완전 복귀.

**검증**: A~G 시나리오(적용/사용자 우선/치수 전환/미등록/404·malformed/flag off/
사용자 데이터화 경계) 전부 격리 origin 통과, storage 최종 0키, runAll 전체 통과,
골든 diff 0, 원본 JSON·`AGENTS.md` 미추적 보존.
