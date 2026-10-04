# 다트이동 엔진 — 현재형 계약

> **이 파일이 소유하는 것**: `js/dartMove.js` 가 **지금** 하는 일(파이프라인·계층·세그먼트 규칙·상수).
> **소유하지 않는 것**: 왜 이렇게 됐는지(연대기 → [`docs/history/dart-engine.md`](../docs/history/dart-engine.md)),
> 착수 전 설계 의도([`docs/spec/dart-engine-layering.md`](../docs/spec/dart-engine-layering.md)),
> 사용자 확정 결정의 원문([decisions.md](decisions.md) → CLAUDE.md).
> 소유권·링크 규칙은 [README.md](README.md).

- `verified-at`: HEAD `c3f5954` — 아래 함수명·상수값은 이 시점의 `js/dartMove.js` 에서 확인했다.
- 현재형만 쓴다. 과거 시도·폐기 사유는 쓰지 않는다(예외: 맨 아래 「부재 목록」).
- 이 파일은 **현재 구현의 관찰 기록**이다. 코드는 관찰 근거일 뿐 규범적 결정의 상위가 아니다.
- 모든 절은 `source:` 를 가진다. 코드·문서와 불일치가 보이면 **어느 쪽도 자동으로 고치지 않는다** —
  🔒/🏛 결정과 테스트를 대조해 버그인지 문서 노후화인지 검토하고 **보고**한다([README.md § 불일치 처리 규칙](README.md)).

## 1. 데이터 모델 — 현재 형상 하나

- `bakedSegments` 는 항상 **현재 형상 하나**다. 열린 다트 V 노치 = 현재 외곽선(유지), 닫힌(입 0) 다트 = 과거 흔적(제거).
  다중다트 부채꼴로 열린 노치가 여럿 남는 것은 정상이다.
- 제거 조건은 하나다: **입이 `EPS_CLOSED_DART` 미만인 pivot 왕복 다리쌍(면적 0 서브패스)**. 구현은 `normalizeBakedSegments`.
- source: [decisions.md D-001](decisions.md) · 구현 `normalizeBakedSegments` / `EPS_CLOSED_DART` ·
  근거 [history/dart-engine.md § normalizeBakedSegments 구현](../docs/history/dart-engine.md)

## 2. 파이프라인

`cut → rotate → bake → normalize → validate → render`

| 단계 | 함수 |
|---|---|
| 절개점 | `findCutPoint` · `findCutPointBack` |
| 분할 | 1차(원본 도안) `splitFrontOutline` · `splitBackOutline` / 2차 이상(baked 기준) `splitBakedOutline` |
| 합성 | `bakeFromSplitPieces` |
| 청소 | `normalizeBakedSegments` |
| 검증 | `evaluateEndpoint` (아래 3.①) · `validateBakedSegments`(진단용) |

- `evaluateEndpoint` 는 내부에서 `bakeFromSplitPieces` → `normalizeBakedSegments` 를 순서대로 부른다.
- source: `js/dartMove.js` 해당 함수 · CLAUDE.md § 5개 핵심 "심장" 함수 · [decisions.md D-001](decisions.md)

## 3. 평가 4계층 (+ 부호 선택)

| 계층 | 함수 | 책임 |
|---|---|---|
| ① 끝점 | `evaluateEndpoint(ctx, angleRad)` | 그 각도의 최종 형상 하나만 평가. `{angleRad, shape, valid, reasons, metrics}` |
| ② 스윕 | `findPhysicalSweepLimit` | 0→θ 회전 경로의 물리 도달 한계. `blockedBy` 는 `leg-barrier` / `piece-collision` |
| ③ 최대 적용각 | `findMaxApplicableMagnitude` | ② 한계 안에서 ① 을 스캔해 최대 적용 가능 크기를 찾는다 |
| 부호 | `selectRotationSign` | 두 부호의 도달 가능 각도를 비교. reason: `source-notch` / `max-reachable` / `tie-geometric` / `no-room` |
| ④ 요청각 | `resolveRequestedAngle(ctx, requestedRad, limitRad)` | 요청각을 적용 가능 각도로. reason: `request-valid` / `zero-request` / `snap-boundary` / `none-valid` / `zero-limit` |

- **① 의 `reasons` 는 넷뿐**: `discontinuous` · `loop-open` · `self-intersection` · `budget-exceeded`.
  `piece-collision` 은 ② 의 책임이며 ① 이 검사하지 않는다.
- 입력 조립은 `prepareDartMoveCandidate` 가 한다(DOM·`dartMoveState` 를 읽지 않는 순수 함수). 반환의 `evalCtx` 를 ④ 가 그대로 받아 쓴다.
  `withSelfXBaseline` 이 자기교차 기준선을 ctx 에 한 번만 싣는다.
- **적용 게이트(`applyDartMove`)**: ① `MIN_DART_ANGLE_RAD` 미만 거부 → ② `piece-collision` 검사 → ③ `evaluation.valid` 단일 진실
  (`getCurrentDartEvaluation` 이 현재 각도와 일치하는 evaluation 을 돌려주고 valid 는 호출부가 직접 분기).
- source: `js/dartMove.js`(각 함수 앞 주석) · [decisions.md D-007·D-008](decisions.md) ·
  설계 의도 [spec/dart-engine-layering.md](../docs/spec/dart-engine-layering.md)
  (⚠️ spec 은 ③ 을 `findApplicableIntervals` 로 적지만 **코드의 이름은 `findMaxApplicableMagnitude`** 다 — §6)

## 4. 각도·예산

- 한 번의 드래그 최대각(`baseAngle`)은 이 옷 전체의 고정 기본 다트량이다: 앞 `calcFrontBaseDartAngle`, 뒤 `calcBackBaseDartAngle`
  (보조 `calcCloseAngle`). 자동 적용하지 않는다.
- **예산은 사후 게이트**다: 적용 후 열린 다트들의 BP 기준 각도 합이 `budgetRad × DART_BUDGET_TOL` 을 넘으면 ① 이 `budget-exceeded` 로 막는다.
  사전 clamp 는 없다.
- `choosePhysicalCloseAngle` 은 gen-0(닿은 기존 notch 없음) 의 **기하 부호 힌트**일 뿐이다. 최종 부호는 `selectRotationSign` 이 정하고
  기하 부호는 동률 tie-breaker 로만 쓰인다. sourceNotch 이동은 notch 에서 부호를 직접 유도하며 요청 크기는 `sourceNotchRequestMagRad` 가 정한다.
- source: CLAUDE.md § closeAngle / userAngle · `js/dartMove.js` 해당 함수 주석

## 5. 세그먼트 타입 규칙

| type | 의미 | 규칙 |
|---|---|---|
| `dart-leg-new` | 지금 열려 있는 다트 입구(`pair: "A"\|"B"`) | **항상 `disabled:true`**. 닫힌 노치가 아니다 |
| `dart-leg-old` | 이전에 닫힌 잔여 다리(`pair: "oldA"\|"oldB"`) | 다시 쪼개지면 안 된다. 폭 0 으로 닫히면 normalize 가 제거한다 |
| `dart-leg` · `dart-bridge` | 다리·브리지 | `isBakedBoundarySeg` 가 위 둘과 함께 경계로 취급한다 |

- dart-leg 계열은 어디서 오든 `disabled:true` 여야 한다 — 아니면 다음 세대 bake 에서 일반 외곽선으로 오인돼 조각 경계가 깨진다.
- **다중다트**: 새 절개가 직전 다트와 무관한 위치여도 직전 다트는 열린 채 남는 것이 정상이다("자동으로 닫는다"는 개념 없음).
- 판별 함수: `isDartLegType` · `isBakedBoundarySeg` · `isClickableSeg` · `isReferenceSeg`.
- source: CLAUDE.md § 세그먼트 타입 규칙 · `js/dartMove.js` `bakeFromSplitPieces`

## 6. 계약(불변) — 코드를 바꿀 때 어기면 안 되는 것

- ①~④ 와 `prepareDartMoveCandidate` 는 **순수**하다: DOM·`dartMoveState` 를 읽지 않고 입력을 변형하지 않는다. 로그·사용자 문구는 controller 책임.
- `evaluateEndpoint` 가 돌려준 `shape` 는 **불변 스냅샷**이다(preview/apply 가 같은 참조를 공유한다). 변형 금지.
- **중복 평가 금지**: ④ 는 확정 각도의 `evaluation` 을 함께 돌려주며 `evaluation.angleRad === resolvedAngleRad` 다.
- **0° 보존**: 요청이 0 이거나 `MIN_DART_ANGLE_RAD` 미만이면 `resolved = 0`(평가 없음).
- **격자 스캔은 최종 판정 기관이 아니다** — 반환된 `evaluation.valid` 하나가 안전 판정이며 이 실제 차단은 제거 금지.
- ④ 는 드래그 방향 이력을 보지 않는다(같은 요청각 → 같은 결과).
- source: [decisions.md D-007·D-008](decisions.md) · `js/dartMove.js` 각 계층 주석

## 7. 상수 (HEAD `c3f5954` 에서 관찰한 값의 사본 — 규범 아님)

| 상수 | 값 | 쓰임 |
|---|---|---|
| `MIN_DART_ANGLE_RAD` | 0.5° | 퇴화 다트 하한 |
| `DART_BUDGET_TOL` | 1.15 | 예산 게이트 허용폭 |
| `EPS_CLOSED_DART` | 0.05 cm | normalize 닫힘 판정 |
| `EVAL_BREAK_EPS` | 0.05 cm | ① 연속성 |
| `EVAL_LOOP_EPS` | 0.05 cm | ① 폐곡선 닫힘 |
| `INTERVAL_SCAN_STEPS` | 60 | ③·④ 격자 |
| `INTERVAL_BISECT_ITERS` | 18 | 경계 이분탐색 |
| `SIGN_TIE_EPS_RAD` | 1e-4 | 부호 동률 |
| `RESOLVE_TIE_EPS_RAD` | 1e-9 | ④ 경계 동률 |
| `SWEEP_TIE_EPS_RAD` | 1e-6 | ② 동률 |

## 부재 목록 — 이 이름들은 **코드에 함수로 존재하지 않는다**

```
ABSENT: calcCloseAngleByMouthPair, chooseSignedBaseAngle, budgetMaxAngle, applyTimeSafeAngle, findMaxSafeAngle, findApplicableIntervals
```

- 이 이름들은 CLAUDE.md·spec·history 본문에 아직 남아 있어 문서만 보고 호출·재도입하기 쉽다. 코드에는 주석으로만 남았다.
  대응 현행 이름: ③ = `findMaxApplicableMagnitude`, 부호 = `selectRotationSign`.
- source: [docs/STATUS.md § 다음에 확인할 것 — legacy 순수 삭제 완료](../docs/STATUS.md) · `js/dartMove.js` 에서 `function <name>` 정의 없음(2026-10-04 확인)
