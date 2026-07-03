# 문화식 원형 에디터 (pattern-editor)

## 프로젝트 비전 (모든 작업의 최우선 원칙)

> 우리 프로젝트는 패턴사를 한 번에 대체하는 것이 아니라,
> 패턴사의 작업 원리를 학습하고,
> 반복 작업을 도와주고,
> 점점 더 많은 판단과 작업을 자동화하여,
> 최종적으로 패턴사를 대체할 수 있는 CAD/AI 패턴 엔진으로 발전한다.

## 제1법칙 (모든 버그 판단의 기준)

> 우리는 종이 위에 있다.

물리적으로 불가능한 결과(끊긴 외곽선, 겹치는 조각, 종이가 찢어지는 형태)는
항상 버그다. 좌표가 맞아 보여도 종이로 접었을 때 말이 안 되면 잘못된 것이다.

## 프로젝트 개요

- 브라우저 기반 문화식(Bunka) 원형 슬로퍼 에디터, JS/SVG
- 사용자(김)는 전문 패턴사이자 도메인 전문가. 최종 판단권자.
- Claude Code = 파일 직접 수정/버그픽스 담당
- ChatGPT = 아키텍처 분석 담당 (종종 Claude에게 지시서 형태로 전달됨)
- Gemini = 리서치 담당
- 참조 치수: B=83, W=64, BL=38
- 참고 문헌: 分카 패션 컬리지 教科書 『パターン製作の基礎』 (86~114쪽)

## 아키텍처 (잠긴 결정사항)

### 5개 핵심 "심장" 함수
- `splitFrontOutline` / `splitBackOutline` — 1차 다트: 원본 도안 기준 분할
- `splitBakedOutline` — 2차 이상: baked 결과 기준 분할
- `choosePhysicalCloseAngle` — pointInPolygon 부호 검증으로 회전 방향 결정
- `bakeFromSplitPieces` — 회전 후 최종 외곽선 재조립

### 상태 구조
- `appliedFront` / `appliedBack` 각각: `bakedSegments`, `pivot`, `cutPoint`, `angle`, `side`
- `getFrontTargetOutline`/`getBackTargetOutline`: bakedSegments 있으면 그것 반환, 없으면 buildFrontOutline/buildBackOutline

### 세그먼트 타입 규칙
- `dart-leg-new` = 새 다트 다리 (`disabled:true`), `pair: "A"|"B"` — **지금 열려 있는
  다트 입구.** 닫힌 노치가 아니다. 다음 세대가 한쪽은 회전·한쪽은 고정시켜 서로
  붙게 만드는 것 자체가 "다트를 닫는" 동작.
- `dart-leg-old` = 잔여 다트 다리 (`disabled:true`), `pair: "oldA"|"oldB"` — **그보다
  이전에 이미 완전히 닫힌 잔여 흔적.** 절대 다시 쪼개지면 안 됨.
- `isBakedBoundarySeg`: dart-leg, dart-leg-new, dart-leg-old, dart-bridge 전부 포함
- **dart-leg 계열은 어디서 오든(trailing 재사용 포함) 항상 `disabled:true`여야 함** — 아니면
  다음 세대 bake에서 일반 외곽선처럼 취급되어 조각 경계가 깨짐
- **다중다트 원칙**: 새 절개는 직전 다트와 완전히 무관한 새 위치여도 되고, 그 경우
  직전 다트는 그대로 열린 채 남아있는 게 정상 동작(여유분을 여러 곳에 분산 배치 —
  패턴사가 결정할 몫). "직전 다트를 자동으로 닫는다"는 개념 자체가 없음.

### closeAngle / userAngle
- `closeAngle`은 계산값(`choosePhysicalCloseAngle`)이며 `baseAngle`(드래그 최대치)로만 사용, 절대 자동 적용 안 함
- `userAngle`은 항상 0에서 시작
- **각도 크기는 몇 차 다트이동이든 항상 이 옷 전체의 고정 "기본 다트량" 공식**
  (`calcFrontBaseDartAngle`/`calcBackBaseDartAngle`, B 공식 기준 G/GG 또는
  dartCenter/dartEnd_)에서 가져온다. `calcCloseAngleByMouthPair`(직전 다트의 현재
  벌어진 폭을 역산하는 방식)는 2026-07-03 세션에서 완전히 제거함 — 그 폭이 이미
  커져 있으면 새 절개 위치가 pivot에서 멀수록 다트 폭이 폭발하는 버그가 있었음
  (예: 30cm 다트). 부호만 `choosePhysicalCloseAngle`이 최종 결정.

### 파일 분리 / 클래스화
- `dartGeometry.js`/`dartState.js`/`dartInteraction.js` 분리: 엔진 안정화 전까지 보류
- `DartMoveEngine` 클래스화: 버그 해결 전까지 금지

## 최근 해결된 핵심 버그 (2026-07-03 세션)

2026-07-02 세션에서 미해결로 남겼던 다중다트 자기교차 버그를 포함해, 같은 뿌리에서
나온 문제 4가지를 전부 해결. 사용자가 스크린샷으로 재현("부채꼴로 다트가 여러 개
뻗어나오고 조각이 겹침/끊김/필요없는 선")할 때마다 원인을 좁혀가며 순차적으로 고침.

1. **다리 쌍 분리로 인한 찢어짐 (근본 원인)**: `splitBakedOutline`이 forward/backward로
   나눌 때, 같은 dartId의 다리 쌍(pivot에서 만나는 하나의 노치) 중 한쪽만 회전
   조각에, 반대쪽은 rest(고정)에 들어가는 경우가 있었음. 회전된 쪽만 새 위치로
   이동하며 노치가 찢어짐. → dartId 그룹을 만들어 forward/backward candidate가
   갈라놓으면 **통째로 rest로 편입**(축소만 하고 절대 확장 안 함 — 이전에 확장
   방식으로 시도했다가 restSteps 회계가 깨진 전례 있음). 단, **가장 최근에 생긴
   dartId는 이 보정에서 제외** — `dart-leg-new`(pair A/B)는 지금 열려 있는 입구라
   다음 세대가 쪼개서 닫는 게 정상 동작이고, 여기까지 강제로 묶으면 절대 닫을 수
   없게 됨(아래 5번 버그의 전조였음).
2. **가짜 봉합선**: 1번 보정으로 rest에 편입된 다리 쌍이 배열 꼬리에 걸리면,
   `bakeFromSplitPieces`의 trailing 판정(꼬리의 다트선 뭉치 = 이미 열린 다트로
   자연 연결)이 이걸 trailing으로 오인해서 엉뚱한 지점끼리 잇는 가짜 직선을 만듦
   ("불필요한 선", "회전할 수 없는 공간까지 이동"으로 관측됨). → trailing 후보의
   끝이 실제로 pivot에 닿는지 확인, 안 닿으면 trailing으로 보지 않음.
3. **렌더러가 안 붙어있는 조각을 이어 그림**: `render.js`의 `drawAppliedSegments`가
   같은 `seg.type`(예: `front-neckline`)이면 좌표 연속성 확인 없이 계속 이어
   그렸음. `bakedSegments` 순서가 살짝만 흔들려도 화면에서는 매끄럽게 이어진 것처럼
   보임. → 이전 점과 `seg.from` 거리가 0.05cm 이내일 때만 같은 곡선으로 이음.
4. **자기교차는 판단이 아니라 차단 대상**: `findSelfIntersections` 헬퍼를 분리해
   DEBUG 여부와 무관하게 상시 동작하게 하고, `applyDartMove`에서 bake 직후·커밋
   직전에 검사 → 겹치면 적용 자체를 막고(hint로 안내) 드래그 상태를 유지해 사용자가
   각도/조각을 바꿔 재시도할 수 있게 함.
5. **다트량 계산 자체의 폭주 버그 (진짜 근본 원인)**: 2차 이상에서
   `calcCloseAngleByMouthPair`로 "직전 다트의 현재 벌어진 폭"을 역산해 각도로 썼는데,
   그 폭이 이미 커진 상태에서 pivot에서 먼 새 위치를 자르면 코드(=2×거리×sin(각도/2))
   때문에 다트가 30cm까지 폭주함. 사용자 확인: "새 절개는 직전 다트와 무관해도 되고
   직전 다트는 열린 채 남아있는 게 맞다" — 즉 "직전 다트를 닫는다"는 전제 자체가
   틀렸음. → `calcCloseAngleByMouthPair` 완전 삭제, 몇 차든 항상 고정 "기본 다트량"
   공식(`calcFrontBaseDartAngle`/`calcBackBaseDartAngle`, G/GG 또는
   dartCenter/dartEnd_ 기준)의 크기만 사용, 부호는 기존처럼
   `choosePhysicalCloseAngle`이 결정.
6. **자기교차 차단 게이트에 구멍**: `findSelfIntersections`가 `dart-leg-new`/
   `dart-leg-old`를 검사 대상에서 아예 뺐었음(4번 항목에서 만들 때, pivot에서 여러
   다리가 만나는 걸 오탐으로 볼까봐 통째로 제외한 게 화근). 그래서 다리끼리
   또는 다리와 외곽선이 진짜로 교차하는 경우를 못 잡고 그대로 적용됨(부채꼴
   다리들이 서로 관통하는 "나비넥타이" 모양으로 관측됨). → 다트 다리 포함 전체
   세그먼트를 검사하되, "배열 인접"이 아니라 "좌표상 끝점을 실제로 공유하는지"로
   정상 연결(같은 pivot에서 만나는 여러 다리 등)만 걸러내도록 변경. 직선 두 개는
   끝점을 공유하면 그게 유일하게 가능한 교차점이라 이 필터로 안전함.
7. **참고선 vs 재단선 분리 (6번의 후속 정정)**: 6번처럼 전부 검사에 넣었더니
   이번엔 정반대 회귀 — 244/244 전부 차단. 원인 추적 결과, 다트이동을 전혀 안 한
   원본 도안(gen-0)부터 `old-dart` 기준선(G-BP-GG)이 진동상부 곡선과 교차하고
   있었음. 즉 이 선은 재단 외곽선이 아니라 **원본부터 존재하는 다트 기준선/참고선**
   이고, 곡선과 겹치는 게 정상 상태(패턴사 확인). "사용자가 완벽할 때도, 오류일
   때도 있다"고 했던 것도 이것 때문 — 진동선 핸들(localStorage 저장 곡선)이
   기준선과 겹치는 형태였는지에 따라 결과가 달라졌던 것. →
   - `isReferenceSeg` 신설: `old-dart`/`back-shoulder-dart`/`dart-leg-old`/
     `dart-bridge`는 참고선. 자기교차 차단 검사에서 제외.
   - `dart-leg-new`(현재 열린 입구, 실제로 종이가 벌어지는 경계)는 검사 유지.
   - **스침 허용오차(GRAZE_EPS=0.2cm)**: 곡선이 ~1cm 간격 폴리라인 샘플이라
     cutPoint(조각 중점)가 실제 곡선보다 살짝 안쪽에 놓여, 오목 구간 다트 입구에
     0.1cm급 가짜 교차가 생김(실측). 교차점이 세그먼트 끝점 0.2cm 이내면 무시.
   - 렌더 분리: `drawAppliedSegments`의 DART_SKIP에 `old-dart`/`back-shoulder-dart`
     추가(안 하면 굵은 외곽선으로 그려져 "외곽선이 연결됐다"는 오해 유발).
8. **참고선 화면 표시 여부 (7번의 후속)**: 처음엔 참고선을 얇은 점선으로 표시했는데,
   사용자 판단: "패턴사가 이미 판단해서 다트를 옮겼으면 예전 위치 흔적은 필요 없는
   정보다. 다만 완전히 버리지 말고 필요할 때 볼 수 있게." → 기본은 숨김, "참고선
   (옛 다트 흔적)" 체크박스(`#chkRefDart`, 기본 미체크)로 켜면 얇은 점선으로 표시.
   `dart-leg-new`(지금 열려 있는 다트)는 항상 실선으로 표시. `bakedSegments` 데이터
   자체에는 참고선이 항상 그대로 남아있음(폐곡선 조립에 필요) — 체크박스는
   **화면 표시 여부만** 바꾸고 데이터 모델은 안 건드림.
   - **디버깅 팁 + 해결**: 이 항목을 조사하다 `index.html`의 스크립트 버전
     쿼리스트링이 고정값(`?v=1782978399`)이라 브라우저가 render.js 변경을 못
     감지하고 계속 캐시된 구버전을 쓰는 걸 실측으로 확인함(Claude 자신의 미리보기
     환경에서도 겪음 — 코드는 맞는데 화면이 30분 넘게 안 바뀐 것처럼 보였음).
     코드는 맞는데 화면이 안 바뀐 것처럼 보이면 제일 먼저 캐시부터 의심할 것 —
     `fetch(파일경로+'?bust='+Date.now())`로 서버가 실제로 뭘 주는지 먼저 확인하면
     빠르게 구분됨. **사용자 승인 하에 `?v=1782978399` → `?v=20260703`로 갱신
     완료** (index.html의 모든 `<script src>` 태그). 앞으로 dartMove.js/render.js를
     고칠 때마다 이 숫자를 갱신해야 브라우저 캐시로 인한 오판을 피할 수 있음.

**검증** (7번 반영 후 최종): 무작위 시나리오 30건(트라이얼 격리, 세대당 최대 9회,
위치/닫는 양/회전 조각 무작위) — 적용 163건 / 물리 겹침 차단 67건 / 적용 후 잔여
교차 0건 / breaks 0건, 다트 7개까지 정상. 기본 케이스(진동하부 50% → 어깨선 40%)
적용·검증·스크린샷 확인 완료. 사용자가 실제 UI로 재현 요청했던 증상들(목선 오연결,
불필요한 선, 회전 불가능한 공간까지 이동, 다리 관통 자기교차) 전부 확인 완료 —
중간에 한 번 재현 안 됐던 건 브라우저 캐시(하드 리프레시 누락) 때문이었음.

**알려진 사소한 관찰 (버그인지 미판단)**: 새 절개가 우연히 이전 다트의 다리 하나를
같은 조각에 끌고 들어가면, 두 다트가 같은 고정 각도(기본 다트량)를 쓰다 보니
이전 다트 입구가 폭 0으로 저절로 닫히는 경우 관측됨. 물리적으로 말은 되지만
사용자에게는 놀라울 수 있음 — 다음에 필요하면 확인.

## 신규 기능: 회전 각도 자동 상한 (2026-07-03 세션)

**설계 원칙(사용자)**: "다트이동은 사람이 눈으로 딱 맞는 지점을 맞추는 도구가
아니라, 시스템이 회전 가능한 범위 안에서만 움직이게 막아줘야 하는 도구." 끝까지
드래그(또는 더블클릭)하면 물리적으로 가능한 한계에서 시스템이 알아서 멈춰야 함.

```
최대각 = min(기본 다트량 각도, 자기교차 없이 가능한 최대각)
```

- `findMaxSafeAngle(fixedSegs, rotateSegs, pivot, targetAngle)` 신설
  (`choosePhysicalCloseAngle` 바로 다음). targetAngle(부호 검증된 기본 다트량)까지
  겹치지 않으면 그대로 반환, 겹치면 0(항상 안전)과 targetAngle 사이를 22회 이분
  탐색해서 겹치기 직전 각도를 찾음. 조각 클릭 시 1회만 계산(드래그 중 매 프레임
  재계산 아님) — `bakeFromSplitPieces`+`findSelfIntersections` 반복 호출이라
  비용이 있음.
- 클릭 핸들러에서 `dartMoveState.baseAngle`을 이 값으로 설정 — 기존
  mousemove의 `[0, baseAngle]` clamp 로직은 그대로 두되, baseAngle 자체가
  이제 "물리적으로 가능한 최대"를 의미하게 됨. 마우스를 아무리 더 돌려도
  이 한계를 못 넘음 — 별도 snap 로직 없이 하드 clamp 자체가 snap 역할을 함.
- 드래그 핸들 더블클릭 = `userAngle = baseAngle`("끝까지 이동").

**검증**: 무작위 30건×9세대 재실행 — 적용 163→**203건**, 차단 67→**7건**(전부
`safeMaxDeg:0`인 진짜 불가능한 지점, 즉 정상 동작), 적용 후 잔여 교차는 여전히
**0건**, 다트 9개까지 정상. 예전엔 완전히 막혔던 "진동하부 풀클로징 → 어깨선
풀클로징" 조합도 이제 18.25°→17.04°로 자동 축소되어 차단 없이 적용됨.

## 최근 해결된 핵심 버그 (2026-07-02 세션)

`splitBakedOutline`이 이전 세대 `dart-leg-new`/`dart-leg-old`를 잘라 넘길 때
`{from,to,type,disabled}`만 명시적으로 복사하고 `dartId`/`role`/`pair`를 버리던
버그. 기하(breaks/gap)에는 영향 없었지만, `validateBakedSegments`의
"dartId별 다리쌍" 체크가 매번 최신 다트 1개만 검증하는 상태였고(과거 세대
다리쌍 깨짐을 못 잡음), 향후 특정 다트를 ID로 선택/편집하는 기능에는
치명적이었을 것. → segsA/segsB/segsAFull/segsBFull 조립 4곳 모두
`{ ...seg, from, to, type, disabled }`로 스프레드 추가해 dartId 보존.
앞판 BP 피벗 기준 4차 연속 다트이동으로 재검증: breaks:0/gap:0.00cm 유지,
`dartId별 다리쌍` 로그가 `(2)` → `(2,2,2,2)`로 정상화됨.

## 최근 해결된 핵심 버그 (2026-07 세션, 커밋 ba5defa)

`splitBakedOutline`이 1차 다트 전용 단순 로직을 2차 이상에 그대로 써서
생기던 문제들을 전부 수정함:

1. **backward가 forward와 비대칭**이었음 (`nn - forwardSteps`로 나머지 전부
   가져감 → 무관 영역까지 조각에 포함). → backward도 독립 탐색으로 변경,
   양쪽 국소 조각 사이 나머지는 `rest`(항상-고정 영역)로 분리.
2. **segsFull 신설**: 국소 조각(`segs`) + rest를 이은 bake용 전체 체인.
   회전 조각은 국소만, 고정 조각은 rest 포함 전체 사용.
3. **pts polygon 무조건 pivot으로 닫기** → openPts가 이미 dart-leg를 따라
   pivot에 도달했으면 중복 추가 안 함 (`closePolygonPts` 헬퍼).
4. **disabled 플래그 유실**: segsA/segsB/segsAFull/segsBFull 조립 시
   `disabled`를 안 담던 버그. 다음 세대 bake에서 dart-leg가 일반 외곽선처럼
   취급되던 원인.
5. **긴 세그먼트(예: 어깨선) 중간 절단 시 빈틈**: backward가 `cutSegIndex-1`부터
   시작해 cutSegIndex 세그먼트의 from쪽 절반을 통째로 건너뜀. → non-boundary
   cutSegIndex는 cutPoint를 공유 꼭짓점으로 forward(→seg.to)/backward(→seg.from)
   반쪽씩 분할하도록 수정 (1차 `splitFrontOutline`의 walkBackward와 동일 원리).

검증: 1~5차 연속 다트이동, 매회 `breaks:0` / `gap:0.00cm` 유지, 어깨~목선~진동
전 구간 외곽선 무결성 확인 완료.

## 디버그 플래그

- `DEBUG_DART_MOVE = true` — `index.html`에 설정
- `DEBUG_COLORS` — 앞/뒤판 색상 구분 렌더링
- 현재 `splitBakedOutline`에 임시 진단 로그 남아있음:
  `[pivotCheck]`, `[cutSegCheck]`, `[splitBaked]`, `[splitBaked piece summary]`,
  `[splitBaked pieceA/B pts]` — 3차 이상 다트이동 안정성이 충분히 검증되면
  정리 대상 (로직에는 영향 없음, console.log만).

## 작업 파일 범위

- **주 수정 대상**: `js/dartMove.js`, `js/render.js`
- **원칙적으로 손대지 않음**: `index.html`, `init.js`, `draft.js`, `sleeve.js`,
  `storage.js`, `handles.js` (명시적 허락 없이는 금지)

## 작업 스타일 / 워크플로우

- **이론/계획 먼저 → 계획 보고 → 명시적 승인 대기 → 그 다음 코드 수정.**
  "코딩하지말고"라는 말은 문자 그대로 코드를 짜지 말라는 뜻.
- 원인이 명확하고 신뢰가 쌓인 패턴(예: disabled 보존 같은 단순 수정)은
  확인 절차를 줄여서 토큰 효율을 높여도 됨.
- 런타임 데이터(콘솔 로그, 스크린샷)가 이론적 분석보다 우선. 확신이 안 서면
  추측하지 말고 진단 로그부터 추가해서 실측.
- **반복 패치가 계속 어긋나면 멈추고 클린 스펙에서 재설계.** 패치 위에 패치를
  쌓지 않는다.
- 두 작업 환경: 윈도우 사무실(GitHub Desktop), 맥 집(Git CLI)
- 파일 전달: Claude가 수정된 파일을 통째로 전달 → 김이 GitHub 폴더에 교체 →
  `index.html`의 버전 쿼리스트링(`?v=...`) 갱신 → 하드 리프레시 (브라우저 캐시
  문제 자주 발생하므로 매번 확인)
- 토큰 절약을 위해 커밋 후 새 세션으로 시작하는 것을 권장

## 다음에 확인할 것 (열려있는 이슈)

- 위 "알려진 사소한 관찰" 항목이 실제로 문제가 되는지 지켜보기
- 3차 이상 다트이동 + 뒤판(back) 쪽도 계속 스트레스 테스트 (이번 검증은 앞판 중심)
- 임시 디버그 로그(`[pivotCheck]`, `[cutSegCheck]`, `[splitBaked]`,
  `[bake old-leg check]` 등) 정리 시점 판단 — 로직에는 영향 없음, console.log만
- (장기) 파일 분리, class화는 여전히 보류 상태 — 엔진이 충분히 안정된 뒤 재논의
