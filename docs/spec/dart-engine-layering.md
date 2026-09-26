# 형상 엔진 계층화 스펙 (미착수)

> **아직 착수하지 않은 설계 스펙이다.** 그 작업을 실제로 할 때만 읽는다.
> 착수는 별도 승인 후. 완료된 C0~C7 기록은 이 문서 안에 함께 있다.
> 살아있는 계약은 [../../CLAUDE.md](../../CLAUDE.md).

## 형상 엔진 재설계 스펙 (2026-07 합의, 아직 착수 전) — `dartMove.js` 계층화

**방향(사용자 확정)**: `dartMove.js`를 "다트 전용 기능"이 아니라 **현재 패턴 조각을
자르고 회전하고 다시 합치는 형상 엔진**으로 만든다. 다트는 그 엔진이 만들어내는 열린
V 노치일 뿐. `dartId`는 작업 기록으로만 남기고 물리 계산엔 안 쓴다(notch는 항상 현재
폐곡선에서 다시 파생 — 이미 sourceNotch 3차 재설계로 물리에서 제거됨).

**핵심: `evaluateMove`를 4계층으로 분리한다(단일 함수 아님).** 지금 preview/apply가
갈라진 근본 이유는 "이동의 유효성이 끝 상태의 성질이냐, 회전 스윕(0→θ) 전체의
성질이냐"에 코드가 일관되지 않아서다. 이걸 명시적으로 분리한다:
```
evaluateEndpoint(ctx, θ)              // ① 끝점 원자: 그 각도의 최종 형상만 평가
findPhysicalSweepLimit(ctx, θ)        // ② 스윕: 고정×회전 조각의 실제 이동 경로 충돌
findApplicableIntervals(ctx, limit)   // ③ ② 한계 내부에서 ①을 스캔 → 안전"구간 목록"
resolveRequestedAngle(intervals, req) // ④ 요청각을 구간에 맞춤
```
**비단조라 "최대 안전각 하나"로는 부족하다** — 5°는 불가능하고 18°는 다시 가능할 수
있으므로 안전구간을 **구간 목록**으로 표현한다:
```
applicableIntervals: [ { fromRad: 0, toRad: 0.75° }, { fromRad: 17.8°, toRad: 18.06° } ]
```
이래야 "드래그에선 가능했는데 10°에서 적용 거부"가 사라진다. (현재 `applyTimeSafeAngle`
2차 재설계의 40스텝 스캔이 이 구간 탐색의 전신 — 정식 API로 승격하는 셈.)
**③은 반드시 ②의 한계 내부에서만 스캔한다** — endpoint가 나중에 다시 안전해져도 실제
조각 충돌을 통과할 수는 없으므로, `sweepLimit` 바깥의 안전 구간은 존재해도 버린다.
**단순 이분탐색 금지**(비단조를 놓친다 — 실측 0.752°만 찾고 18.06°를 통째로 놓쳤던 전례).

### 계층 책임 경계 (사용자 확정, 위반 금지)

- **①의 `reasons`는 이 넷으로 제한한다**: `discontinuous` / `loop-open` /
  `self-intersection` / `budget-exceeded`. **`piece-collision`은 ①이 아니라 ②의 책임**
  — 책임이 다른 검사를 양쪽에 중복시키는 건 "no part" 원칙 위반이다.
- **①은 조용해야 한다**: 콘솔 출력·사용자 문구 금지, 구조 데이터만 반환. 60스텝×양쪽
  부호에서 `validateBakedSegments`가 로그까지 찍으면 느리고 로그가 폭발한다. **로그와
  사용자 문구는 controller 책임.**
- **0°는 항상 보존한다**: `MIN_INTERVAL_RAD`로 구간을 자를 때 드래그 시작점 0°가 0.5°로
  튀면 안 된다. 규칙: `requested === 0` 또는 `|requested| < MIN_DART_ANGLE_RAD` →
  **`resolved = 0`**(중립 preview). 0°는 일반 안전구간과 분리해 다룬다. "적용 가능한
  다트"만 0.5° 이상이면 된다.
- **shape는 불변 스냅샷**: preview/apply가 같은 참조를 공유하는 건 좋지만, 이후 코드가
  배열이나 좌표를 변경하면 **캐시까지 오염된다**. 평가 결과 shape는 불변으로 취급하고,
  **commit 후 해당 eval context를 폐기**한다. split/render가 입력 shape를 변경하지 않는다는
  순수성 테스트를 추가한다.
- **C7에서도 실제 차단은 남긴다**: `console.assert(ev.valid)`만 남기면 운영에서 잘못된
  형상이 저장된다. 중복 게이트는 제거하되 **단일 진실은 유지**:
  ```js
  if (!ev?.valid) return rejectMove(ev?.reasons);
  commitMove(ev);
  ```
- **⚠️ C7 할 일 — C1의 임시 `throw` 제거**: `applyDartMove` 커밋 직전의 C1 이중 검증
  블록(`[C1] endpoint evaluation mismatch`로 `throw`)은 **마이그레이션 기간 한정**이다.
  브라우저에서 throw로 적용을 막는 건 임시로만 허용되고, C7에서 위 `rejectMove` 단일
  거부 경로로 바꿔야 한다(사용자 지시). 그때 중복 bake도 함께 사라진다 →
  C6에서 preview/apply가 같은 shape를 공유하면 이 블록 자체가 불필요해진다.
  실측 비용: front 964→1043ms, multi 614→645ms, oldest 885→917ms,
  backRandomStress(40×8) 2573→2638ms (약 +3~8%).

### 확정된 결정 (사용자 답변)

1. **source 보존**: 이번 리팩터에선 `metrics.conservationErrRad`로 **측정만**. `valid`
   게이트에 넣지 않는다 — 동작 변경 없이 구조만 통합하고, 게이트화는 별도 기능 변경으로.
2. **금지구간 스냅**: **가장 가까운 경계**, **드래그 방향 이력 무시**, **동률이면 작은 각도**.
   같은 요청각은 항상 같은 결과를 낸다(히스테리시스 금지 — preview 재현성이 깨진다).
3. **`SCAN_STEPS = 60`** 확정. 정확도를 먼저 잠그고 C3에서 성능을 실측한다.
   **`≤1.2×`를 넘으면 스텝을 몰래 줄이지 말고 평가 중복부터 제거한다.**

### 성능 (기준선 실측 2026-07)

조각 선택 1회: **gen-0 = bake+normalize 50 / rotColl 79 / 81ms**(양쪽 부호),
**sourceNotch = 25 / 60 / 65ms**(단일 부호). 스위트: front 974ms / oldest 877ms /
multidart 624ms / back 347ms / purity 521ms / backRandom(40×8) 2573ms.

⚠️ **gen-0에서 60스텝×2부호면 최대 120회 endpoint bake로 현재 50회보다 많아질 수 있다.**
캐시는 **드래그 재평가**에는 듣지만 **서로 다른 스캔 각도는 줄여주지 않는다**. 따라서
`≤97ms`는 **보장값이 아니라 C3의 통과 조건**이다. 진짜 재원은 지금
`budgetMaxAngle`과 `applyTimeSafeAngle`이 **각자의 그리드에서 따로 bake**하는 중복이다 —
같은 샘플 그리드를 공유하면 그 중복이 사라진다.

**데이터 모델**: `PatternShape{segments, pivot, side, revision}` /
`NotchInstance{legIn, legOut, mouthA, mouthB, apertureRad}` / `SplitResult{pieceA, pieceB}` /
`Piece{localSegments, fullSegments, sourceNotch}`. API: `deriveNotches / splitShape /
evaluateMove(4계층) / commitMove / validateShape`. **preview와 apply가 반드시 같은
`evaluateEndpoint`를 쓴다.**

**파일 4개(과분할 금지)**: `dartGeometry.js`(점·각도·회전·교차·거리) /
`dartTopology.js`(notch 추출·split·bake·normalize) / `dartEngine.js`(source 다트량·회전
방향·안전각·evaluateMove) / `dartMove.js`(UI 상태·클릭·드래그·적용·렌더 연결).
**`dartEngine.js`는 DOM 입력값이나 `dartMoveState`를 직접 읽지 않는다** — pivot/budget/
segments를 인자로 받는 순수 함수(이미 `test/harness/dartDriver.js`가 이 인터페이스를
예행연습 중 — 추출 = "하네스가 인자로 넘기는 걸 프로덕션도 인자로 받게").

**지배 불변식(모든 적용 결과)**: 폐곡선 연속성 / 자기교차 0 / 닫힌 흔적 0 / source
감소량=new 증가량(단 gen-0은 "원본 다트각 감소=new 증가", 뒤판은 ~0.1cm sliver
허용오차) / 무관한 notch 변화 0 / 전체 다트각 보존 / `normalize∘normalize=normalize` /
**preview 결과=apply 결과**.

### 순서 ③ 커밋 계획 (evaluateMove 4계층 통합)

| # | 제목 | 프로덕션 | 골든 |
|---|---|---|---|
| **✅ C0** | `Add regression fixtures for non-monotonic safe intervals` (`a8c3a82`) | 무변경 | 신규 |
| **✅ C1** | `Extract endpoint evaluation…` (`6980faf`) + `Verify endpoint evaluation against legacy apply gates` (`b3ee83d`) | ① + 런타임 이중 검증 | 무변경 |
| **✅ C2** | `Extract physical sweep limit from safe angle search` (`a4ac4b0`) | ② | 무변경 |
| **✅ C3** | `Return applicable angle intervals` (`8c8159e`) (+성능 실측) | ③ (신설만, 배선 안 함) | 무변경 |
| **✅ C4** | `Choose rotation sign from max applicable magnitude` (`bda51a5`) + perf 골든 (`cd4bbfc`) | `chooseSignedBaseAngle` 우회(삭제는 C5/C7) | shape 무변경 / perf 갱신 |
| **✅ C5** | `Resolve requested drag angle…` (`5cf9af6`) + `Move dart-move harness off legacy…` (`f542abc`) + `Remove legacy dart angle chain…` (`0e58b82`) + `Reproduce sign-selection golden…` (교정) | ④ + clamp 교체 + legacy 순수 삭제 | **전부 무변경**(sign-selection.json 포함) |
| **✅ C6** | `Share evaluated shape…` (`888225e`) + `Enforce and test…` (`68d89b2`) + `Collapse C6 reuse contract…` (`02e009f`) | preview·apply가 evaluation.shape 공유 | 무변경 |
| **✅ C7** | `Reduce apply-time gates to single source of truth` (`7e0dafd`) | apply를 evaluation.valid 단일 진실로 축소 | 무변경 |

### ✅ C0 완료 (2026-07) — 비단조 픽스처와 3가지 발견

**① 과거 0.752°/18.06° 사례는 재현되지 않았다.** 현재 sourceNotch 엔진과 조사한
**1956개 시나리오**에서 0건. 과거 부호 선택 경로(`chooseSignedBaseAngle` /
`calc*CloseAngleByRotateHit` 계보 — 후자는 `524e8f7`에서 삭제)에 종속된 사례로
판단하며, **현재 엔진에서 재현된 비단조 사례 3건으로 회귀 픽스처를 교체**한다.
과거 숫자를 억지로 보존하지 않는다.

**② 현재 엔진의 실제 비단조 3건** (전부 같은 레시피, 조각/부호만 다름):
`gen0: front-armhole-lower@0.5 B ×0.5 → 2차: front-armhole-lower@0.65`

| 케이스 | 조각/부호 | sweepLimit | 구간 (800스텝 진실값) | 금지폭 |
|---|---|---|---|---|
| 1 (주 회귀) | A / + | 10.950° | `[0, 9.1485] ∪ [9.3694, 10.4937]` | 0.221° |
| 2 (좁은 금지구간) | A / − | 9.733° | `[0, 0.3068] ∪ [0.3448, 1.3687]` | **0.038°** |
| 3 (조각 대칭) | B / + | 9.733° | 〃 | 〃 |

**③ 계층 계약이 테스트 버그를 잡았다.** 첫 oracle이 `piece-collision`을 endpoint
유효성에 섞었는데(계약 위반), 바로잡자 결과가 달라졌다 — ②의 한계 내부에서 스캔해야
비로소 다중구간이 드러난다. **`SCAN_STEPS=60` 확정은 실측으로 정당화됨**: 60은 3건
모두 탐지, **40은 케이스2/3을 놓친다**. (앞서 "60이 놓친다"고 본 건 budget(18.25°)
위에서 스캔한 오판 — ③은 **sweepLimit 위**를 스캔하므로 해상도가 0.30°→0.18°로 촘촘하다.)
**60스텝+이분탐색 경계가 800스텝 진실값과 소수 4자리까지 일치** — 격자는 "구간 발견"만
하고 경계 정밀도는 이분탐색이 담당한다.

**⚠️ 그래서 더 중요해진 안전 원칙**: 케이스2의 금지구간 0.038°는 60스텝 간격(0.162°)
보다 **4배 좁다.** 잡힌 건 샘플이 우연히 안에 떨어져서지 **보장이 아니다**. 격자 스캔은
원리적으로 스텝보다 좁은 구간을 보장 탐지할 수 없다(스텝을 늘려도 "더 좁은 구간"이
있으면 같은 문제). 따라서 **`findApplicableIntervals`는 편의상 구간을 제공할 뿐 최종
안전 판정 기관이 될 수 없다**. 반드시 이 순서를 유지한다:
```
resolved angle → evaluateEndpoint(ctx, resolvedAngle) → ev.valid → valid일 때만 preview/commit
```
스캔이 좁은 금지구간을 놓쳐도 **정확한 요청각의 evaluateEndpoint가 마지막에 잡는다.**
이 단일 실제 차단은 **C7에서도 제거 금지**.

**부수 발견 — notch 신원은 순서 무관 쌍이어야 한다**: `mouthA`/`mouthB` 라벨은
안정적이지 않다. bake/normalize가 폐곡선 순서를 다시 짜면 같은 notch라도 어느 다리가
legIdxA인지 뒤바뀐다(실측: 이동 전후 mouthA가 정확히 자기 aperture만큼 극각 이동한
것처럼 보였는데 반지름은 불변 — 회전이 아니라 A/B 스왑이었다). 라벨 순서로 매칭하면
**불변인 notch를 "변했다"고 오판**한다. `unrelatedNotchInvariant.js`는 좌표쌍을
사전순 정규화해 신원을 만든다.

**C0 산출물**: `nonMonotonicIntervals.js`(21) / `signSelectionFixture.js`(12) /
`unrelatedNotchInvariant.js`(8) / `perfBaseline.js`(4) / `golden/{nonmonotonic,sign-selection,perf-baseline}.json`.
`perfBaseline`은 **호출 횟수만 실패 조건**(bake·normalize·rotColl·selfX), 벽시계
시간은 정보용(PC 상태 의존). 800스텝 oracle은 `--oracle800` 선택 실행.

### ✅ C3 완료 (2026-07) — `findApplicableIntervals` 신설 (배선은 C4/C5)

**범위(사용자 확정): 추가·검증만. 기존 프로덕션 경로는 한 줄도 안 건드린다.**
`prepareDartMoveCandidate`의 `findMaxSafeAngle → budgetMaxAngle → applyTimeSafeAngle`는
그대로고, `budgetMaxAngle`·`applyTimeSafeAngle`·`chooseSignedBaseAngle` 전부 유지된다.
→ 프로덕션 호출 횟수 불변 → **12스위트 전부 통과, 골든 파일 diff 0**(perf 골든 포함).
`js/dartMove.js` diff는 **88줄 추가 / 0줄 삭제**(순수 추가, 실측 확인).

**API (`evaluateEndpoint` 바로 다음, ENGINE 구역)**:
```
findApplicableIntervals(ctx, limitRad) →
  { sign, intervals: [{ fromMagRad, toMagRad }], scan: { steps, limitMagRad } }
```
- **필드명이 Mag인 이유**: 구간은 항상 크기(양수)다 — `0 ≤ fromMagRad ≤ toMagRad ≤ limitMagRad`,
  실제 각도는 `sign`을 곱해 얻는다. `fromRad`로 두면 음수 부호에서 from>to가 되어
  **비교하는 쪽마다 부호 버그**가 생긴다(사용자 지적). 정렬·비중첩 보장.
- `limitRad`가 0이면 스캔할 구간 자체가 없다 → `sign:0, intervals:[]`, evaluateEndpoint 호출 0.
- **①만 쓴다**(`piece-collision`은 ②의 책임), **②의 한계 내부만 스캔**, **조용하다**(로그 0).
- **★ 0°와 MIN_DART_ANGLE_RAD를 여기서 자르지 않는다 (사용자 확정)**: C3는 순수하게
  endpoint 유효구간만 발견한다. 0° 중립 처리와 최소 적용각은 **④ `resolveRequestedAngle`
  (C5)의 책임**이다. 여기서 트리밍하면 0 근처의 작은 안전구간 정보가 ④에 닿기 전에
  손실된다 — 케이스2/3의 첫 구간이 `[0, 0.307°]`로 **MIN(0.5°)보다 작아서** MIN 트리밍을
  넣었으면 통째로 사라졌을 것이다(`applicableIntervals.js`가 이걸 직접 검사한다).

**평가 중복 0 (사용자 요구, 실측 확인)**: 캐시(Map)를 추가하지 않고 구조로 해결했다 —
격자점 유효성을 배열에 담아두고, 이분탐색은 **양 끝 격자점을 재평가하지 않고** 중점만
평가한다(중점은 항상 셀 내부라 격자점과 겹치지 않고, 셀당 경계는 최대 하나라 서로도 안 겹침).
실측: **총 115 = 서로 다른 angle 115 = 격자 61 + 경계 3개 × 이분탐색 18, 중복 0**(3케이스 동일).

**검증 — `test/harness/applicableIntervals.js` 신규 (57 PASS, 자체 골든 없음)**:
C0 3케이스에서 프로덕션 ③가 **독립 oracle과 소수 3자리까지 일치**
(case1 `[0, 9.148] ∪ [9.369, 10.494]`, case2/3 `[0, 0.307] ∪ [0.345, 1.369]`).
검사 항목 = 사용자가 준 완료 조건 그대로: 비단조 구간 발견 / 경계 오차 ≤0.1°(**커밋된
픽스처 상수 + 독립 oracle 양쪽**과) / ② 한계 바깥 구간 없음 / 구간 내부 대표점 valid /
금지구간 대표점 invalid / 정렬·비중첩 / limit=0 퇴화 / 중복 평가 0.
**골든을 새로 만들지 않았다** — 진실값의 출처는 이미 커밋된 C0 픽스처 하나이고,
새 골든은 같은 숫자의 두 번째 사본이 될 뿐이다.

**픽스처 추출 — `test/harness/nonMonotonicFixture.js` 신규**: `CASES`/`BASE_RECIPE`/
`setupCase`/oracle(`sweepLimitMag`/`endpointValid`/`scanIntervals`)을 C0 스위트에서 뽑아
두 스위트가 공유한다. 이유는 순서 ②의 `prepareDartMoveCandidate` 추출과 같다 —
**복제하면 한쪽만 고쳐도 조용히 어긋난다.** 보고서의 반올림 숫자를 재입력하지 않고
커밋된 픽스처를 기준으로 삼으라는 사용자 지시의 구조적 이행이기도 하다.
추출은 동작 보존을 실측으로 확인했다(`nonMonotonicIntervals.js` 26 PASS, 출력·골든 동일).
**⚠️ oracle은 프로덕션을 호출하지 않는 독립 검증기다 — 프로덕션이 이 모듈을 import하는
것도 금지**(그러면 같은 코드를 두 번 부르는 것이라 검증이 아니다).

**성능 (배선 전 · 정보용)**: ③ 단독 = 케이스당 evaluateEndpoint 115회(=bake+normalize
115회), ~470ms. **`≤1.2×`는 C3에서 강제하지 않는다** — 아직 프로덕션에 배선되지 않아
판정할 대상이 없다(사용자 확정). 기준선(gen-0 bake 50 / rotColl 79)은 그대로 통과.
판정은 **C4/C5 배선 후 실제 프로덕션 경로에서** 내리고, 개선이 확인된 뒤 perf 골든만
별도 커밋으로 갱신한다.

**★ C4/C5 배선 때 쓸 성능 재원 (C3에서 발견)**: `evaluateEndpoint`가 **매 호출마다
`findSelfIntersections(ctx.prevBakedSegments)`로 기준선을 다시 계산한다**
(`baselineSelfXCount`). 이 기준선은 **스캔 내내 불변**이라 115회 스캔이면 114회가 낭비다.
→ **✅ 해소** (`4ca95f4`): `withSelfXBaseline(ctx)`가 한 번만 구해 파생 ctx로 넘긴다
(캐시가 아니라 상수를 상수로 다루는 것, 입력 ctx 비변형). 실측 selfX 230→116, ~470→265ms.
`??`를 쓴다 — `||`였다면 기준선 0을 놓쳐 매번 재계산했을 것이다.

### ✅ C4 완료 (2026-07) — 부호 선택을 최대 도달 각도 탐색으로 (`bda51a5`)

**⚠️ 먼저: 이 문서가 예상했던 성능 재원은 실재하지 않았다 (C4 실측).**
위 "성능" 절은 *"진짜 재원은 `budgetMaxAngle`과 `applyTimeSafeAngle`이 각자의 그리드에서
따로 bake하는 중복"*이라고 적었지만, **틀렸다.** legacy의 부호당 25 bake를 분해하면:
`findMaxSafeAngle`=rotColl만(bake 0) / `budgetMaxAngle`=24스텝 전부(24) /
`applyTimeSafeAngle`=**끝점이 안전하면 즉시 반환(1)**. 골든의 50 = 25×2부호와 정확히
일치한다. **정상 경로에서 두 번째 그리드는 아예 열리지 않으므로 흡수할 중복이 없었다.**

그래서 ③ `findApplicableIntervals`를 그대로 배선했더니 격자 61점을 무조건 다 돌아
**gen-0 bake 50→122(2.44×), 81→316ms(3.9×)** 로 1.2× 게이트를 넘었다(selfX는 2→122 —
legacy의 budget bake는 자기교차를 안 봤다). 늘어난 비용은 중복이 아니라 **전부 새로 하는
일**(더 조밀한 격자 + 격자점마다 자기교차 검사)이었다 — 즉 "평가 중복 제거"라는 처방을
적용할 대상 자체가 없었다.

**해법(사용자 확정): 열거하지 말고 탐색한다 — 그리고 위에서 아래로.**
C4가 필요한 건 `maxReachable` **한 값**뿐이다. 한계각부터 내려오면 정상 경로(한계각이
그대로 적용 가능)는 **평가 1회**로 끝난다. **스텝을 줄이지도(60 유지) 캐시를 넣지도
않는다 — 탐색 방향만 바꾼다.**
```
findMaxApplicableMagnitude(ctx, limitRad) → { maxMagRad, valid, reason, scan:{steps,evaluated,refined} }
  reason: limit-valid(정상, 평가 1회) / scan-boundary / none-valid / zero-limit
```
**⚠️ 아래→위로 훑으면 안 된다**: 0 근처의 좁은 구간에 갇혀 더 높은 구간을 놓친다 —
`applyTimeSafeAngle` 1차 구현이 정확히 그 실수를 했다(0.752°만 찾고 18.06° 놓침).
회귀 테스트로 못 박음: C0 비단조 케이스에서 위→아래 탐색이 **먼 구간 상단 10.494°**를
찾고 가까운 구간(9.148°)에 **갇히지 않는다**(평가 4 + 정밀화 18).

**성능 (기준선 대비, 같은 환경)**:
| 경로 | bake | rotColl | selfX | 시간 |
|---|---|---|---|---|
| gen-0 | 50 → **2** (0.04×) | 79 → 79 | 2 → 2 | 81 → 78ms |
| sourceNotch | 25 → **1** (0.04×) | 60 → 60 | 2 → 2 | 65 → 64ms |

868조합 실측 평가 횟수: **sourceNotch 평균 1.0 / gen-0 평균 29.7**(양쪽 부호 합) ·
최악 95. 부호당 상한 61(끝점 1 + 격자 60) + 정밀화 18 — 최악은 legacy 25 대비 2.44×지만
평균은 훨씬 아래다. **★ 이제 bake가 아니라 ②의 rotColl 60스텝 스캔이 비용을 지배한다**
(bake 25배 감소인데 시간은 거의 그대로인 게 그 증거) — 다음 성능 작업의 대상은 여기다.

**검증**: legacy 체인과 **868조합 전수 대조 불일치 0**(front/back × gen-0/1다트/2다트/
비단조 setup, `signSelectionMigration.js`). `rotationSignSelection.js` 51 PASS —
한쪽만 가능 / 양쪽 가능 / sourceNotch 단일 부호 / leg-barrier / 평가 횟수 계약 /
exact 반환각 재검증. **EPS 동률과 양쪽 불가는 현재 도안 기하에서 0건**(두 부호
maxReachable 최소 차이 10.53° — EPS 1e-4rad보다 6자리 크다)이라 ②/탐색을 스텁해
결정 규칙만 격리 검증했다. shape 골든 전부 무변경.

**계층 계약 실측 소견 — C0 비단조는 프로덕션 ② 한계 밖이다**: C0 oracle의 ② 한계는
`findRotationCollisions`만 스캔해 **leg-barrier를 포함하지 않는다**(10.950°). 프로덕션
`findPhysicalSweepLimit`은 barrier를 포함해 **8.848°**에서 자른다. 비단조 구멍
(9.148~9.369°)이 그 위에 있어 프로덕션 경로에서는 **보이지 않는다** — ③/탐색이 계약
("② 한계 바깥은 endpoint가 valid여도 버린다")대로 동작한 결과다. 또한 C0 setup은
1다트 상태라 **sourceNotch 경로**를 타므로 케이스의 부호(+/−)가 선택기 후보와 1:1
대응되지 않는다. (다중구간 자체는 실재하며 ③에 oracle 한계를 주면 그대로 나온다.)

**남긴 것 / C5가 결정할 것** (→ 전부 C5에서 처리 완료, 아래 "C5 완료" 참고):
- `findApplicableIntervals`(③)는 C3 구현 그대로 두되 **production 경로에서 호출하지
  않는다.** C5에서 전체 구간 목록이 정말 필요한지 다시 판단하고, lazy exact-evaluation
  으로 간다면 **테스트/진단 전용으로 둘지 삭제할지 명시적으로 결정한다 — 미사용인 채
  C7 이후까지 남기지 않는다**(사용자 지시). → **삭제 확정(C5d).**
- `budgetMaxAngle` / `applyTimeSafeAngle` / `chooseSignedBaseAngle`은 삭제하지 않았다.
  C5/C7에서 실제 호출이 0이 된 뒤 **별도 순수 삭제 커밋**으로 지운다. → **C5d에서 삭제.**
- `prepareDartMoveCandidate`의 `limits`(단계별 캡)는 **`selection`으로 대체**했다 —
  그 세 단계가 이제 존재하지 않는다(예산·델타·연속성이 ① 평가 하나에 접힘). 없는 값을
  null로 남기는 대신 부호별 실제 근거를 노출한다.

### ✅ C5 완료 (2026-07) — ④ resolveRequestedAngle 배선 + legacy 순수 삭제

**한 문장: 드래그 clamp `[0, baseAngle]`를 ④로 교체하고(비단조 스냅), ③를 포함한 legacy
죽은 섬 5개를 지웠다(dartMove.js −250줄). 동작 변경 0.**

3커밋(C5b는 perf 골든 무변경이라 별도 커밋 없음 — 검증 전용):
- **C5a** (`5cf9af6`): `resolveRequestedAngle(ctx, requestedRad, limitRad)` 신설, mousemove·
  더블클릭·dartDriver를 같은 ④로 연결. 예전 `clamp(0, baseAngle)`는 [0,baseAngle]이 전부
  안전하다고 가정했지만 endpoint는 비단조라(C0 `[0,9.148]∪[9.369,10.494]`) 요청각이
  금지구간에 떨어질 수 있다 → 가장 가까운 경계로 스냅.
- **C5c** (`f542abc`): 하네스의 legacy 직접 호출 제거. `backDeterministic.js`를
  `prepareDartMoveCandidate`+④ 경로로 이전. `resolveRequestedAngle.js` 신설(비단조·스냅
  커버리지 이전, 64검사).
- **C5d** (`0e58b82`): 순수 삭제. `findMaxSafeAngle`/`budgetMaxAngle`/`applyTimeSafeAngle`/
  `chooseSignedBaseAngle`/`findApplicableIntervals` + `applicableIntervals.js`/
  `signSelectionMigration.js` + 죽은 `requestedAngleRad`. `rotationSignSelection.js`는
  프로덕션 ③를 oracle로 쓰던 3곳을 독립 oracle `scanIntervals`로 교체("프로덕션으로
  프로덕션 검증" 냄새 제거).
- **C5 교정** (별도 교정 커밋): C5d가 `signSelectionFixture.js`와 함께 잠긴 shape 골든
  `sign-selection.json`을 삭제한 것을 되돌린다. **골든은 삭제 금지 대상**(C0에서 잠금,
  "shape 골든 무변경" 규칙 위반)이었다. 골든을 삭제 전과 byte-for-byte 복원하고,
  `signSelectionFixture.js`를 **현재 C4 API로 같은 snapshot을 만드는 최소 검증기**로
  다시 작성했다(legacy는 복원 안 함). 재현 매핑: legacy `findMaxSafeAngle`·
  `budgetMaxAngle→applyTimeSafeAngle`가 부호마다 따로 내던 physical/usable을
  `selectRotationSign`의 candidate `physicalLimitMagRad`/`maxReachableMagRad`가 그대로
  담는다(C4 동치 — 시나리오당 `prepareDartMoveCandidate` 호출 1번). **골든 재현 실측:
  16 PASS, 골든 diff 0.**

**확정 사항(사용자 보정 반영)**:
- **③ 삭제**: ④는 mousemove마다 돈다. ③ 구간 열거는 격자 61점 무조건 스캔(~265ms)이라
  드래그가 죽는다. lazy exact는 정상 경로(요청각 그대로 valid) **평가 1회**로 끝난다
  (실측 gen-0 1.27ms / sourceNotch 1.34ms). ③는 프로덕션 소비자가 영원히 없어 삭제.
- **`requestedAngleRad` 삭제**: 실제 요청각은 mousemove에서 계산되며, 이 필드는 조각
  선택 당시의 초기값이라 의미가 다르다. resolver 입력으로 재사용하지 않는다(소비자 0).
- **중복 평가 금지**: ④가 resolved 각도의 `evaluation`을 함께 반환한다(계약:
  `evaluation.angleRad === resolvedAngleRad`, resolved 0이면 null). preview가 다시 평가
  안 함. 스냅 시 반환하는 evaluation은 **스냅한 각도의** 것(요청각의 것이 아니다).
- **안전 판정 = evaluation.valid 하나**: 유한 격자는 스텝보다 좁은 valid island를 놓칠
  수 있어 경계 탐색은 스냅 보조일 뿐. **이 단일 차단은 C7에서도 제거 금지.**
- **0/MIN 보존**: `|요청| < MIN_DART_ANGLE_RAD` → resolved 0(평가 0회). MIN 적용은 ④의 몫.
- **순수/재현성**: dartMoveState/DOM 미접근, 드래그 방향 이력 무시(히스테리시스 금지),
  동률이면 작은 각도.

**★ C5에서 실측으로 드러난 계층 계약**: C0 case2/3의 금지구간(0.307~0.345°)은 MIN(0.5°)
보다 작아 **④에서는 관측 불가능**하다 — ③는 MIN을 안 자르고(그 구간을 봄) ④는 자른다.
`resolveRequestedAngle.js`가 이 차이를 명시적으로 검증한다(스냅 검사는 lo>MIN인 case1만).

**검증**: 하네스 전체 통과(13스위트 1227검사), shape·perf 골든 무변경. 실브라우저:
legacy 5함수 전부 undefined, 다트이동 조각선택→적용 완주(selfX 0, 열린 다트각 18.25°),
콘솔 오류 0. `index.html` 캐시 버전은 C7 완료 시 한 번만 갱신(개발 중엔 하드 리프레시).

### ✅ C6 완료 (2026-07) — preview·apply가 evaluation.shape 공유 (`888225e`·`68d89b2`·`02e009f`)

**결정**: ④가 만든 evaluation을 버리지 않고 `dartMoveState.evaluation`에 담아 preview와
apply가 같은 shape를 쓴다. 새 캐시·계층 없음 — 이미 만든 걸 한 번 전달할 뿐.
- preview는 그 shape를 apply와 같은 렌더러(`drawAppliedSegments`)로 그린다("preview=apply").
- apply는 재bake 없이 그 shape를 커밋한다.

**단일 계약 `getReusableDartEvaluation()`**: preview·apply가 조건식을 복제하지 않고 이 함수
하나만 부른다(복제하면 preview는 헤드리스 검증 불가라 조용히 갈라진다). 계약 —
evalCtx 존재 / evaluation 존재·valid / `angleRad === userAngle`(정확 비교) /
`Array.isArray(shape) && shape.length > 0`. 못 채우면 null → 각 호출부는 fallback(apply는
재bake, preview는 폴리라인 근사).

**불변식**: 재사용 apply 후 `appliedFront.bakedSegments === evaluation.shape`(object identity,
byte-identical 실측). `evaluation`은 start/selectSide/cancel/reset/apply 5개 전이에서 전부
null(stale 재사용 방지). evaluation.shape는 gate·commit을 지나도 불변(deep snapshot).

**성능 경계**: apply의 bake/normalize **2→1**. 남은 1회는 **C1 임시 이중검증**(C7에서 제거).
per-mousemove bake 1은 유일 evaluation이라 불변 — C6가 손대지 않는다.

**계약 고정**: 위 identity/fallback/dispose/불변을 `purityCheck.js`에 자동 검사로 못박음
(브라우저 1회 성공은 회귀망이 아니다). shape·perf 골든 무변경(하네스가 재사용 경로로
전환됐는데도 diff 0 = 재사용 shape == fallback shape 재증명).

### ✅ C7 완료 (2026-07) — apply를 evaluation.valid 단일 진실로 축소 (`7e0dafd`)

**결정**: apply의 endpoint 안전성은 이제 **`evaluation.valid` 하나가 단일 진실**이다. 예전엔
legacy 게이트들과 C1 이중검증이 같은 판정을 중복으로 냈다 — 전부 ①로 접었다.

**삭제**: apply의 fallback 재bake(`bakeFromSplitPieces`+`normalizeBakedSegments`) / legacy
self-intersection delta 게이트 / legacy budget 게이트 / C1 mismatch throw 블록 전체 /
그로 인해 호출 0이 된 orphan 변수(`_prevBaked`/`_cross0`/`_crossNow`/`_budgetRad`/`_usedRad`
등). **유지(제거 금지)**: MIN(퇴화) / piece-collision(②의 책임 — `evaluation.valid`에 없다) /
`validateBakedSegments` DEBUG 진단 / `evaluateEndpoint` / commit·dispose·render.

**계약 `getCurrentDartEvaluation()`** (C6의 `getReusable…`에서 개명): "현재 각도와 일치하는
evaluation"을 반환한다 — evalCtx 존재 / evaluation 존재 / `angleRad === userAngle` /
`Array.isArray(shape) && shape.length>0`. **`valid`는 안 본다** — valid는 endpoint 안전성의
단일 진실이라 호출부가 직접 분기(apply는 invalid면 reasons 거부, preview는 폴리라인 fallback).

**불변식**: valid apply는 `evaluation.shape`를 **동일 참조**로 commit(bake/normalize **0/0** —
재bake·C1 없음). missing/stale(각도 불일치)/invalid evaluation은 **재평가 없이 상태 유지 후
정상 거부**(mode/userAngle/evaluation/evalCtx 그대로). invalid는 reasons로 사유 분기
(budget-exceeded/self-intersection/discontinuous·loop-open/기타).

**동치 회귀망**: `endpointEquivalence.js`(720)가 삭제된 legacy 게이트를 **독립 재구현
(`legacyGates`, 프로덕션 비의존 동결 앵커)**해 `evaluateEndpoint`와의 동치를 하네스에서
계속 강제한다. `backDeterministic.js`도 프로덕션 mousemove/dartDriver와 같은 evaluation
주입 경로로 정렬(C7은 재bake fallback이 없어 evaluation 필수). shape·perf 골든 무변경.

**★ C0~C7 완료 = 4계층 `evaluateMove` 통합 단계 종료.** ①evaluateEndpoint / ②
findPhysicalSweepLimit / (부호)selectRotationSign / ④resolveRequestedAngle이 배선됐고,
preview·apply가 `evaluation.shape`를 공유하며, apply 안전성은 `evaluation.valid` 하나다.
**다음 단계(geometry/topology 파일 추출·구조 개편)는 자동으로 시작하지 않는다 — 별도
설계·승인 후 진행.**

**골든 JSON 변경 = 즉시 중단 신호.** 이 단계 전체에서 골든은 **절대 `--update` 하지
않는다** — 변경이 필요하면 그건 설계 오류다. C1의 일치 assertion이 불일치를 내면 그
자리에서 정지(C2 이후 진행 금지). 매 커밋: `git diff --check` + `runAll.js` + 골든 무변경.

**⚠️ 단, 이 규칙은 shape 골든에만 적용된다 (2026-07 C3에서 사용자 확정).** 골든은 성격이
다른 두 종류다 — 같은 규칙을 무차별 적용하면 다음 세션이 배선 단계에서 반드시 걸린다.
- **shape 골든**(`front` / `multidart` / `oldest_retarget` / `nonmonotonic` /
  `sign-selection`): "동작이 변하면 안 된다"는 **불변식**. 변경 = 설계 오류 = 즉시 중단.
  이 단계 끝까지 `--update` 금지.
- **perf 골든**(`perf-baseline.json`): 호출 횟수를 고정한 **성능 기준선**. 이 숫자를 줄이는
  것이 C3~C5의 **목표 자체**라 "변경 = 중단"을 적용할 수 없다. 갱신 조건: (1) shape 골든이
  전부 무변경일 것(동작 불변이 유일한 안전망), (2) **사유와 이전/이후 숫자를 커밋 메시지에
  기록**, (3) **성능 개선이 실측으로 확인된 뒤 perf 골든만 별도 커밋**으로 갱신(기능 커밋에
  섞지 않는다 — 섞으면 회귀 원인 추적이 어려워진다).

**`index.html` 캐시 버전은 매 커밋마다 바꾸지 않는다** — 개발 중엔 하드 리프레시로
확인하고, **C7 완료 시 한 번만** 갱신한다. UI 마크업/CSS는 이 단계에서 무변경.

**재설계 순서(사용자 확정, 한 번에 새로 쓰지 말 것)**: ① 현재 동작을 회귀 테스트로
고정(**✅ 앞/뒤 골든 완료**) → ② 한 파일 안에서 순수/UI 함수 분리(**✅ 완료**, 아래) →
③ `evaluateMove`(4계층)로 모든 게이트 통합 → ④ geometry/topology 파일 추출 → ⑤ UI
컨트롤러 얇게 정리 → ⑥ 안정화 후 bake가 처음부터 깨끗한 형상을 만들도록 개선 →
⑦ normalize를 청소기에서 최종 검증기로 축소. **성능 최적화는 맨 마지막**(각도별 평가
캐시·세그먼트 bounding-box 사전검사·동일 bake 중복 제거). 3다트 골든은 현재
post-normalize를 잠그되 **영구 정답이 아니라 리팩터 기간의 호환 기준** — ⑥에서
아티팩트를 근본 개선할 때 `--update`와 변경 사유를 함께 커밋한다.

### ✅ 순서 ② 완료 (2026-07) — 구역 분리 + 공유 순수 함수 추출

커밋 3개로 분리(테스트 구축과 재설계를 한 커밋에 섞으면 회귀 원인 추적이 어려워짐):
`472ee92` 추출 → `588e59f` 하네스 공유 → `9fc804f` 구역 재배치.

1. **`prepareDartMoveCandidate()` 추출** (`472ee92`) — 조각 선택 시 "어느 방향으로
   얼마까지 돌릴 수 있는가"를 결정하는 오케스트레이션이 `initDartMoveClickHandler`와
   `test/harness/dartDriver.js`에 **각각 복제**돼 있던 걸 순수 함수 하나로 뽑았다.
   ```
   prepareDartMoveCandidate({ pivot, budgetRad, rawBaseAngleRad, cutPoint,
     rotatePiece, fixedPiece, prevBakedSegments }) →
     { closeAngleRad, requestedAngleRad, sourceNotch, sourceApertureBeforeRad,
       limits: { physicalRad, budgetRad, applySafeRad }, valid, reason }
   ```
   - DOM/`dartMoveState` 미접근, 입력 비변형. `test/harness/purityCheck.js`가 두 분기
     (sourceNotch/gen-0)에서 입력 비변형 + 결정성을 상시 검증한다.
   - `limits`는 **단계별로 캡된 각도**(입력 `budgetRad`=예산과 이름만 겹치는 다른 것).
     gen-0 경로는 세 캡이 `chooseSignedBaseAngle` 내부에서 두 부호에 대해 수행되므로
     밖에서 알 수 없어 **정직하게 null**(추정값을 지어내지 않는다).
   - `viaSourceNotch` 불리언이 아니라 **실제 `sourceNotch`를 반환** — ③의 evaluateMove
     설계에 유리.
2. **하네스가 같은 함수 호출** (`588e59f`) — `dartDriver.performMove`의 복제 블록 삭제.
   이제 **UI와 테스트의 각도 계산 경로가 하나** → 클릭 핸들러가 바뀌어도 하네스가
   조용히 어긋날 수 없다(테스트는 통과하는데 실제 앱 경로를 대표하지 못하는 위험 제거).
3. **구역 재배치** (`9fc804f`) — 파일 분리 없이 배너로 경계만: 【공용】dbg /
   【GEOMETRY】12개 / 【TOPOLOGY】17개 / 【ENGINE】15개 / 【CONTROLLER】22개.
   `get*TargetOutline`(dartMoveState 읽음), `findCutPoint(Back)`(`n("inpB")` 읽음)은
   engine 순수성 유지를 위해 **controller에 뒀다** — 이들의 순수화는 ③/⑤ 범위.
   **로직 무변경 증명**: 주석·공백 제외 코드 라인 집합이 재배치 전후 완전 동일
   (1774줄→1774줄 multiset 일치). 최상위 실행문 0(함수 선언은 호이스팅, const 5개는
   함수 본문에서만 참조)이라 순서 의존성 없음.

**교훈(다음 단계에 적용)**: 재배치를 먼저 하면 diff가 커져 진짜 동작 변경을 못 찾는다 —
**추출 → 전환 → (안정 확인) → 재배치** 순서를 지킬 것. 매 커밋마다 `git diff --check` +
`node test/harness/runAll.js` + **골든 JSON 무변경**을 확인했다.
