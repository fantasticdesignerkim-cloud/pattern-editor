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

### 지배 데이터 모델: "젤리/물 = 현재 조각 하나" (2026-07-07 사용자 확정, 최우선)

> 자르고 → 돌리고 → 붙이면, 결과는 **현재 형상 하나**다.

이 원칙이 다른 모든 조립 결정보다 우선한다. 2026-07-03의 "참고선은 폐곡선
조립에 필요하니 데이터엔 남기고 화면만 숨긴다"(옛 8번 결정)를 **명시적으로 대체**한다.
앞으로 블라우스·절개선·요크·프린세스 라인까지 이어질 핵심 데이터 모델이다.

1. `bakedSegments`는 항상 "현재 형상 하나"여야 한다.
2. **현재 열려 있는 다트 V 노치는 현재 패턴의 실제 외곽선이므로 유지**한다 (실선 렌더).
3. 다중다트 부채꼴처럼 여러 개 열린 V 노치가 남는 것은 정상이다.
4. **폭 0으로 닫힌 다트 / 과거 세대 `dart-leg-old` 왕복 스파이크 / 중복 `old-dart`
   흔적은 과거 기록이므로 normalize에서 제거**한다.
5. 렌더는 normalize된 현재 형상만 그린다.
6. split/bake는 다음 세대 작업을 항상 정리된 현재 형상에서 시작한다.
7. 과거 데이터를 조립용으로 계속 들고 다니는 방식보다 이 원칙을 우선한다.

**요약: 열린 다트 = 현재 외곽선(유지) / 닫힌 다트 = 과거 흔적(제거).**
"모든 다트를 병합해 노치도 안 남기는 방식"이 **아니다** — 그러면 부채꼴 다중다트가
사라진다. 구현: apply 직후 `normalizeBakedSegments`(폭 0 닫힘 쌍·왕복 스파이크
제거, 외곽선 재연결, 열린 웨지 유지). **✅ 2026-07-08 구현 완료** (아래
"normalizeBakedSegments 구현" 섹션). 파이프라인이 이제
`cut → rotate → bake → normalize → validate → render`. 델타 안전망은 문지기로 유지
(normalize=청소기, 게이트=문지기).

### 5개 핵심 "심장" 함수
- `splitFrontOutline` / `splitBackOutline` — 1차 다트: 원본 도안 기준 분할
- `splitBakedOutline` — 2차 이상: baked 결과 기준 분할
- `choosePhysicalCloseAngle` — 회전 방향(부호) 결정. **2026-07-07 결정적 기하 판정으로
  교체**: cutPoint 직후 외곽선 점의 pivot 기준 외적 부호로 결정(pointInPolygon 샘플
  방식은 얇은 부채꼴에서 오판 → 폐기, 퇴화 케이스만 폴백).
- `bakeFromSplitPieces` — 회전 후 최종 외곽선 재조립. **normalize는 아직 이 안에 없음.**
- (조력) `findMaxSafeAngle`(각도 배리어 `rotationLegBarrier` 포함) / `findRotationCollisions`
  / `findSelfIntersections(segs, pivot)` — 회전 한계·겹침 판정 (2026-07-07 섹션 참고)

### 상태 구조
- `appliedFront` / `appliedBack` 각각: `bakedSegments`, `pivot`, `cutPoint`, `angle`, `side`
- `getFrontTargetOutline`/`getBackTargetOutline`: bakedSegments 있으면 그것 반환, 없으면 buildFrontOutline/buildBackOutline

### 세그먼트 타입 규칙
- `dart-leg-new` = 새 다트 다리 (`disabled:true`), `pair: "A"|"B"` — **지금 열려 있는
  다트 입구.** 닫힌 노치가 아니다. 다음 세대가 한쪽은 회전·한쪽은 고정시켜 서로
  붙게 만드는 것 자체가 "다트를 닫는" 동작.
- `dart-leg-old` = 잔여 다트 다리 (`disabled:true`), `pair: "oldA"|"oldB"` — **그보다
  이전에 이미 완전히 닫힌 잔여 흔적.** 절대 다시 쪼개지면 안 됨. **단, 지배 모델
  (젤리/물)상 폭 0으로 닫힌 것은 normalize 제거 대상이다** — 구현 후엔 baked에
  누적되지 않는다. (렌더는 2026-07-07부터 이미 실선 패턴선으로 그림)
- `isBakedBoundarySeg`: dart-leg, dart-leg-new, dart-leg-old, dart-bridge 전부 포함
- **dart-leg 계열은 어디서 오든(trailing 재사용 포함) 항상 `disabled:true`여야 함** — 아니면
  다음 세대 bake에서 일반 외곽선처럼 취급되어 조각 경계가 깨짐
- **다중다트 원칙**: 새 절개는 직전 다트와 완전히 무관한 새 위치여도 되고, 그 경우
  직전 다트는 그대로 열린 채 남아있는 게 정상 동작(여유분을 여러 곳에 분산 배치 —
  패턴사가 결정할 몫). "직전 다트를 자동으로 닫는다"는 개념 자체가 없음.

### closeAngle / userAngle
- `closeAngle`은 계산값(`choosePhysicalCloseAngle`)이며 `baseAngle`(드래그 최대치)로만 사용, 절대 자동 적용 안 함
- `userAngle`은 항상 0에서 시작
- **한 번의 드래그 최대각(baseAngle)**은 몇 차 다트이동이든 이 옷 전체의 고정 "기본
  다트량" 공식(`calcFrontBaseDartAngle`/`calcBackBaseDartAngle`, B 공식 기준 G/GG 또는
  dartCenter/dartEnd_)에서 가져온다. `calcCloseAngleByMouthPair`(직전 다트의 현재
  벌어진 폭을 역산하는 방식)는 2026-07-03 세션에서 완전히 제거함 — 그 폭이 이미
  커져 있으면 새 절개 위치가 pivot에서 멀수록 다트 폭이 폭발하는 버그가 있었음
  (예: 30cm 다트). 부호만 `choosePhysicalCloseAngle`이 최종 결정.
- **⚠️ 지배 결정 수정 (2026-07-08, 아래 "다트 예산 게이트" 섹션)**: 예전엔 "매 다트
  = 항상 풀 기본각"이었는데, 이게 다중다트에서 **각도 과생성**(총합 2~8×)을 일으켰다.
  새 결정: **다중다트는 매 다트에 기본각을 복제하는 것이 아니라, 적용 후 열린 다트들의
  BP 기준 각도 합이 기본 다트각 "예산"을 넘지 않아야 한다.** 단, 정상 재분배(부분
  드래그로 기존 다트를 닫으며 새 다트를 여는 것)를 허용하기 위해 budget 검사는
  사전 clamp가 아니라 **사후 게이트**로 수행한다(remaining=budget−used 사전 축소는
  잔여 다트가 예산을 먹어 정상 재분배까지 막으므로 폐기). baseAngle 자체는 여전히
  풀 기본각이고(끝까지 드래그 = 전체 다트를 그 위치로 relocate), 여러 다트를 동시에
  열려면 **부분 드래그**로 예산을 나눠 쓴다.

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

## 최근 해결된 핵심 버그 (2026-07-07 세션) — 렌더/과회전/잔선

이번 세션의 핵심 교훈: **회전 한계는 폴리곤 겹침판정이 아니라 순수 각도 계산으로
풀어야 강건하다.** pivot(BP) 근처에서 point-in-polygon은 정상인 1차 다트조차
오탐이 나서 못 쓴다 (실측: gen-0도 "겹침"으로 잘못 나옴).

1. **가슴다트/다트다리/노치 선이 화면에서 생략됨** → `render.js`의 `drawAppliedSegments`
   `DART_SKIP`을 `dart-bridge`만 남기고 축소. `dart-leg-new/dart-leg-old/old-dart/
   back-shoulder-dart`는 이제 실제 패턴선으로 렌더. `drawDartMoveApplied`의 참고선
   점선 렌더 블록(`REF_TYPES`/`chkRefDart`/`_mkDart`) 전부 제거. **원칙: 현재 baked
   결과에 남은 선은 전부 실제 패턴선이다.** (`chkRefDart` 체크박스는 이제 무효)

2. **"가슴다트 방향으로만 과회전" (진짜 근본 원인)**: 회전하는 다트 다리가 pivot을
   공유하는 **기존 다트 다리를 각도상 그냥 지나쳐 버렸다.** 두 다리가 pivot을
   공유하니 `segmentsCross`가 "끝점 공유(sharesEndpoint)"로 검사를 건너뛰고, 회전
   조각이 이전 다트가 열어놓은 **빈 웨지를 그대로 통과**했다. 그 방향에 기존 다트/
   가슴다트가 있어 정확히 "가슴다트 방향으로만" 과회전. → **`rotationLegBarrier`
   신설** (`findMaxSafeAngle` 안에서 호출): 회전 다리(pivot→cutPoint)가 회전 방향
   으로 만나는 "가장 가까운 고정쪽 dart-leg-new/old 다리" 앞(마진 0.3°)에서 멈춤.
   순수 각도 계산이라 폴리곤 노이즈 없음. **old-dart(원본 가슴다트)는 배리어에서
   제외** — 1차 다트는 그걸 닫는 동작이고 targetAngle 자체가 이미 G→GG 각도라
   min으로 알아서 멈춤(1차 풀클로징 18.25° 보존, 실측 확인). `findMaxSafeAngle`에
   `cutPoint` 인자 추가(호출부에서 `dartMoveState.cutPoint` 전달).

3. **회전방향 부호가 추측에 의존** → `choosePhysicalCloseAngle`을 결정적 기하 판정
   으로 교체: rotatePts는 cutPoint에서 조각 외곽선을 따라 걷는 점들이므로,
   cutPoint 직후 점의 pivot 기준 외적 부호가 곧 "조각 본체가 있는 쪽". 예전
   pointInPolygon(±0.01rad 샘플)은 얇은 부채꼴에서 양쪽 다 폴리곤 밖이라 무게중심
   추측(CENTROID 분기)으로 떨어졌고, 그 추측이 틀리면 몸판으로 파고들었음 —
   "어쩔 때는 맞고 어쩔 때는 틀리다"의 정체. (퇴화 케이스만 옛 샘플 방식 폴백)

4. **회전 전용 충돌검사** `findRotationCollisions` 신설: 강체 회전은 같은 조각
   내부 상대기하를 보존하므로, 회전 한계는 [고정 조각]×[회전 조각] 쌍 + 양쪽
   mouth 다리만 검사한다. bake 전체 `findSelfIntersections`를 쓰면 저장된 진동하부
   곡선이 옆선과 거의 접한 **같은 조각 내부 접선 노이즈**까지 걸려 멀쩡한 1차
   다트를 0°로 오차단했던 회귀가 있었음(각도마다 FP로 교차했다 사라졌다 함).
   `findMaxSafeAngle`·적용 차단 둘 다 이 기준 사용.

5. **퇴화 다트(잔선) 차단**: 안전각이 사실상 0(0.5° 미만, `MIN_DART_ANGLE_RAD`)
   이면 조각선택·적용 양쪽에서 차단. 안 그러면 입구가 안 벌어진 다리 두 개가 같은
   자리에 겹친 방사형 잔선이 생김.

6. **델타 안전망 (적용 직전)**: 이 회전이 **이동 전 형상 대비 자기교차를 새로 늘리면**
   적용 거부. `findRotationCollisions`가 못 잡는, bake가 새로 만드는 잔여벽(legOld)
   관통까지 걸러냄. **기준선 = 이동 전 저장된 검증필 형상**
   (`appliedFront/appliedBack.bakedSegments`, 없으면 0).
   **2026-07-07 후속 수정 (아래 "델타 안전망 기준선 버그" 섹션)**: 예전엔 각도0
   재조립(`baked0`)을 기준선으로 썼는데, `bakeFromSplitPieces`의 각도0 재조립이
   항등이 아니라 깨끗한 저장 형상(교차0)을 split→rebake하면 없던 교차가 생겨
   (실측 baked0X=2) 기준선이 오염됐음. 저장 형상으로 교체 후 오차단 0 유지.

7. **`findSelfIntersections`에 `pivot` 인자 추가 (스침 판정 정밀화)**: 다트 다리의
   pivot 반대쪽 끝점들을 junctionPoints(G/GG/cutPoint 등 "설계상 곡선과 만나는
   기준점")로 모아, 교차점이 그 근처면 스침으로 무시(GRAZE_EPS_JUNCTION=0.7cm,
   무작위 스윕 실측 근거: 정상 스침 0.19~0.59cm vs 실제 겹침 1.5cm+, 사이가 비어
   안전). 곡선 샘플 타입(`CURVE_SAMPLED_TYPES`) 관련 교차에만 적용, 직선끼리는
   항상 진짜 겹침.

**검증(무작위 50런×6세대)**: 과회전(swept-past) **12→0건**, 적용후 자기교차
**69→7건**. (남은 7건은 아래 "델타 안전망 기준선 버그" 세션에서 근본 해소됨.)
**실제 UI 순차 다트이동(진동선 오른쪽부터, 어깨쪽 조각, 풀클로징)은 완전히 깨끗**:
breaks 0 / loopGap 0 / 자기교차 0 / 중복다리 0.

## 최근 해결된 핵심 버그 (2026-07-07 후속) — 델타 안전망 기준선

**증상**: 사용자 스트레스 테스트에서 앞판 다트가 부채꼴로 몸판(옆선)을 관통하는
결과가 여전히 저장·렌더됨(`side-seam × dart-leg-new` 자기교차). 한 번 생기면 이후
세대로 영구 누적.

**근본 원인**: 델타 안전망이 기준선으로 `bakeFromSplitPieces(..., angle:0)`(baked0)을
썼는데, **이 각도0 재조립이 항등이 아니다.** 깨끗한 저장 형상(자기교차 0)을
split→rebake만 해도 없던 교차가 생긴다(실측: 저장본 0 → baked0 **2**). 그래서
실제로 몸판을 관통하는 결과(교차 1)가 "오염된 기준선(2)보다 적다"며 안전망을
통과 → 커밋됨. **게이트가 자기 자신의 망가진 기준선에 속은 것.**

**수정**: 기준선을 **이동 전 저장된 검증필 형상**
(`side==="back" ? appliedBack : appliedFront)?.bakedSegments`, 없으면 0)의 자기교차
수로 교체. 저장 형상은 이미 이 게이트를 통과한 깨끗한 형상이므로 정직한 기준선.
불변식: **정상 다트 이동은 이동 전보다 자기교차를 늘리지 않는다.**
`bakeFromSplitPieces` 자체의 근본 재설계(normalize)는 여전히 다음 작업으로 남지만,
이 게이트 수정만으로 물리적으로 불가능한 결과가 저장/렌더되는 것은 완전 차단됨.

**검증(실제 patched applyDartMove 헤드리스 구동)**: 겹침 안은 채 적용
**59→0건**(60런×8세대), 교차로 끝난 run **13→0건**, 정상 적용 480건 그대로
(오차단 0). 추가 시드(12345/777/42, 총 120런·최대 10세대)에서도 자기교차·예외
**전부 0**. 캐시 버전 `?v=2026070720`.

**남은 열린 이슈**: 위 buffer 자체의 항등성 결여(각도0 rebake가 교차를 만드는 것)는
아래 normalize 구현으로 근본 해소됨(각도0 normalize 자기교차 0 실측). 게이트는
문지기로 유지.

## normalizeBakedSegments 구현 (2026-07-08) — 물/젤리 엔진 1단계

**배경(사용자 지시)**: 지금까지 6개 증상별 패치(findMaxSafeAngle/GRAZE/render/dartId/
rotationLegBarrier/델타게이트)는 각각 맞았지만 전부 부분 패치였다. 진짜 밑바닥
문제는 하나 — **"현재 형상을 하나의 깨끗한 조각으로 재생성하는 단계가 없다."**
그래서 bake가 매 세대 과거(닫힌 다트·왕복 스파이크·legOld 찌꺼기)를 이고 다니고,
한 오류를 막으면 다른 데서 또 터졌다. 필요한 건 패치가 아니라 청소기.
**한 문장: 닫힌 흔적은 녹이고, 열린 다트는 현재 외곽선으로 남긴다.**

**핵심 설계 — 케이스별 삭제가 아니라 단일 불변식으로 통합**:
> 제거 = pivot을 떠나 pivot으로 되돌아오되 "입"(두 바깥 끝점 거리)이 0인 다트 다리쌍
>        = 면적 0 서브패스. (닫힌 다트/폭0/왕복 스파이크/역방향 중복 다리/0폭 legOld
>          전부 이 조건 하나로 잡힘)
> 유지 = 입이 벌어진(면적>0) 다리쌍 = 지금 열린 다트 = 현재 외곽선(부채꼴 다중다트 포함).

bake 출력이 이미 `pivot→…→pivot` 순서 루프(legOut→outlineA→legOld/trailing→
reversed outlineB→legIn)라 이 판정이 로컬하게 성립. `normalizeBakedSegments`를
`bakeFromSplitPieces` 다음에 신설, `applyDartMove`에서 bake 직후·validate 앞에 호출.
파이프라인: **cut → rotate → bake → normalize → validate → render**.

**ε 튜닝 (EPS_CLOSED_DART = 0.05cm), 실측 근거**: 무작위 50런×6세대에서 pivot 접점
다리쌍 488개의 "입 너비" 분포 — 닫힌 다트는 정확히 **0.00cm에 응집**(두 다리 완전
중첩, float drift<1e-4), 적용 가능한 가장 작은 정상 다트 입은 **~0.087cm**(0.5°×짧은
다리, MIN_DART_ANGLE_RAD 하한). 0.05는 그 사이 빈 구간 — **닫힘만 녹이고 실제 다트는
전부 보존**(지우는 쪽이 아니라 남기는 쪽으로 안전). 참고: 0.05–0.5cm 구간의 다리쌍은
pivot 근처 짧은 다리를 풀각도로 자른 **정상적인 작은 다트**라 절대 지우면 안 됨
(ε를 0.5로 잡으면 진짜 다트를 지운다 — 실측으로 확인하고 0.05로 확정).

**다중다트 보존 검증 (사용자 최대 우려 지점)**: (1) 3열림 부채꼴 형상에 normalize를
적용해도 **3열림 유지** — normalize 자체는 열린 다트를 절대 안 죽인다. (2) 세대 간
refeed에서도 조각 선택에 따라 **2열림 다중다트 도달 가능**. normalize=2 vs 무normalize=3
의 차이 1개는 정확히 "닫힌 가슴다트 흔적이 재분할로 재개방된 아티팩트" = 사용자가
녹이라고 한 바로 그것. 즉 정상 다중다트는 보존, 아티팩트 부풀림만 제거.

**최종 검증(실제 patched applyDartMove, 60런×8세대·475 적용)**: 자기교차 **0** /
연속성 breaks **0** / **닫힌 다트쌍 잔존 0**(매 적용 후 전부 녹음) / 예외 **0** /
멱등성·각도0항등 통과. 실제 UI 4연속 다트 후 스크린샷 — **BP 방사형 잔선 완전 소멸,
단일 깨끗한 형상**. 캐시 버전 `?v=2026070721`.

**주의(다음 세션)**: normalize는 "정리"까지 완성했지만, `bakeFromSplitPieces`가 닫힌
흔적을 split에서 **재개방하는 아티팩트 생성 자체**는 여전히 남아있다(normalize가
사후 청소하므로 결과는 깨끗하지만, 근본적으론 split/bake가 열린 다트를 강체로 이고
가도록 재설계하면 아티팩트가 애초에 안 생긴다 — 다중다트 3개+ 부채꼴을 의도적으로
쌓는 워크플로우가 필요해지면 그때 착수). 뒤판(pivot=E) normalize는 공용 경로라 함께
타지만 뒤판 중심 스트레스 검증은 아직.

## 다트 예산 게이트 (2026-07-08) — 각도 과생성 차단

**증상**: normalize·delta게이트가 다 통과한 깨끗한 형상인데도 앞판에 다트가 8갈래
부채꼴로 남음. 진단 결과 closed:0, selfX:0 — 잔선이 아니라 **열린 다트가 너무 많이,
각도 총합이 과하게** 생성된 것. (사용자 브라우저 콘솔 실측으로 확정: normalize 정상,
전부 열린 다트.)

**근본 원인 (실측)**: 열린 다트들의 BP 기준 각도 합이 보존돼야 하는데(제1법칙:
종이에서 BP 주변 각도는 창조 불가), 무작위 478 적용 측정 시 **분포가 이봉형**:
- **90.4%(432건)는 총합 ≤ 1.05× budget** — 정상 재분배(새 다트 열림 ↔ 기존 다트
  닫힘). "다른 위치" 다트이동은 이미 예산을 보존한다.
- **9.6%(46건)는 2~8× 폭발**(최대 149.8°=8.2×, 7다트). 병리적 컷+조각(기존 다트
  다리를 팽창 방향으로 끌고 감)에서만 발생. 1.05×~2× 사이는 **비어 있음**.
즉 8갈래 부채꼴 = 병리적 과생성이 누적된 것. 기존 게이트(selfX)는 각도 과생성을
selfX=0으로 통과시켜 못 잡았다.

**설계 (사후 게이트, 각도 기준)**: `applyDartMove`에서 bake→normalize 후, delta게이트
다음에 삽입.
```
budget = |calcFrontBaseDartAngle|  (뒤판: |calcBackBaseDartAngle|)
used   = sumOpenDartAngle(bakedSegments, pivot)   // 열린 다리쌍의 BP 사잇각 합
used > budget × 1.15  →  적용 거부 (드래그 상태 유지, 다른 조각/위치 유도)
```
- ★ **사전 clamp가 아니라 사후 게이트**: `remaining=budget−used`로 새 다트를 미리
  줄이면, 잔여 다트가 예산을 먹고 있어 "닫으며 여는" 정상 재분배까지 막힌다(실측:
  g0 후 g1 198개 전부 차단). 사후 게이트는 결과 총합만 보므로 재분배는 통과시키고
  과생성만 거부한다.
- ★ **반드시 각도**로 계산(`sumOpenDartAngle`). 폭(mouthWidth)은 pivot 거리에 비례해
  보존되지 않는다 — 2026-07-03 #5 `calcCloseAngleByMouthPair` 폭주(30cm 다트)의 교훈.
- **임계값 1.15×**: 실측 분포가 이봉형(정상 ≤1.05× / 병리 ≥2×)이라 그 사이 빈 구간의
  보수적 값. **실측상 빈 구간이라 임시 허용폭이며, 필요 시 1.25×까지 올려도 안전**
  (오탐·미탐 모두 큰 여유). `DART_BUDGET_TOL` 상수.

**검증(실제 patched applyDartMove)**: 무작위 60런×8세대 478 적용 —
과생성 적용(>1.15×) **0건**, 적용된 최대 비율 **1.0×**(전부 예산 보존), selfX 0 /
breaks 0 / closedTraces 0, 예산 차단 이벤트 16회(과생성 이동을 막고 대안 이동으로
진행). **정상 다중다트 분산 보존 확인**: g0·g1 부분 드래그(frac 0.5)로 서로 다른
위치 3곳 모두 **2다트 열림, 총합 18.2°(=1.0×), selfX 0 → 적용됨**(게이트 통과).
풀 드래그(frac 1.0)만 과생성으로 차단. 실제 UI 2다트 분산 스크린샷 — BP에서 뻗은
깔끔한 2개 다트(카오스 부채꼴 아님). 캐시 버전 `?v=2026070722`.

**UX 함의**: 풀 드래그 = 전체 가슴다트를 그 위치로 **relocate**(1다트). 여러 다트로
**분산**하려면 **부분 드래그**(예산을 나눠 씀).

### budget 반영 드래그 한계 (2026-07-08 후속 UX) — `budgetMaxAngle`
적용 시점 게이트만 있으면 "드래그·미리보기에서는 예산 초과 위치까지 가고, 적용
버튼을 눌러야 막힌다" → 사용자는 여전히 "오류"로 느낀다. 그래서 **드래그 한계
(baseAngle) 자체를 예산-aware로 미리 줄인다** — `findMaxSafeAngle`과 같은 스캔+이분
탐색이되 기준이 "sumOpenDartAngle > budget×DART_BUDGET_TOL". selectPiece에서
`closeAngle = budgetMaxAngle(findMaxSafeAngle(...))` 순으로 결합. 드래그는
`[0, baseAngle]`로 clamp되므로 **손이 이미 예산 한계에서 멈춘다**(별도 snap 불필요).
- 정상 재분배: 예산 보존이라 축소 없음(실측 186/190 풀 각도 유지).
- 병리적 팽창: 총합이 예산에 닿는 각도에서 잘림(실측 4/190이 18.2°→1.4°).
- **적용 시점 budget 게이트는 최종 안전망으로 유지** — 드래그 pre-clamp가 upstream에서
  막으므로 정상 사용에선 발동 0회(실측: 이전 16회 → **0회**).
- `DART_BUDGET_TOL`은 모듈 상단 상수(budgetMaxAngle·applyDartMove 공용).

**검증(pre-clamp 포함 실제 경로, 60런×8세대 466 적용)**: 과생성 적용 0, 적용 최대
비율 1.15×(한계 정확히, 초과 0), 적용 시점 게이트 발동 **0회**, selfX/breaks/closed 0,
부분 드래그 2다트 분산 정상. 캐시 버전 `?v=2026070723`.

**남은 것**: 뒤판 예산 게이트/드래그 한계는 공용 경로라 함께 타지만 뒤판 중심
스트레스 검증은 아직.

## 회전 부호 보존 교정 (2026-07-08) — 근본 원인: 크기가 아니라 방향

**분석(코드 수정 전 리포트)**: θ를 0→100% sweep하며 normalize 후 dartId별 각도를
측정한 결과 — **회전 크기(θ)는 정확하다**: 새 다트 각도 = θ로 완벽히 선형 대응(1:1).
- 정상 재분배: 새 다트 = θ, 기존 다트 = budget − θ, **총합 = budget 보존**.
- 병리적 팽창: 새 다트 = θ(여전히 정확), 그런데 기존 다트 = **budget + θ**(닫히는 게
  아니라 부풂) → 총합 = budget + 2θ (최대 3×).
**같은 cut을 부호만 뒤집어 재측정하니 3× → 1× 완벽 보존.** 즉 근본 원인은 회전
크기가 아니라 **회전 방향(부호)** — `choosePhysicalCloseAngle`의 기하 판정(다각형
side)이 다중다트(baked)에서 기존 다트를 "닫는 쪽"이 아니라 "여는 쪽"을 골랐다.
(그래서 UI θ 모델은 바꿀 필요 없음 — θ가 이미 새 다트 각도 그 자체.)

**수정 (`chooseConservingSign`)**: 물리적으로 올바른 다트이동은 BP 각도 총합을
보존하므로(제1법칙), +θ/−θ 두 방향을 모두 bake→normalize→`sumOpenDartAngle`로
평가해 **총합이 작은(=예산에 가까운) 쪽**을 최종 부호로 선택. `choosePhysicalCloseAngle`
의 기하 판정은 **1차 후보로만** 쓰고 여기서 교정한다(동률이면 기하 판정 유지).
selectPiece에서 `choosePhysicalCloseAngle → chooseConservingSign → findMaxSafeAngle →
budgetMaxAngle` 순. **크기는 안 건드리고 부호만 바꾼다. 폭 미사용, BP 각도 총합만.**

**한 문장: 회전 크기는 맞고, 부호 선택을 다트량 보존 기준으로 교정했다.**

**검증**: (1) 정상 재분배 cut — 부호 교정 없음(flipped:false), 총합 18.2°(1.0×) 유지.
(2) 병리적 팽창 cut — **부호 교정됨(flipped:true), 3×→18.2°(1.0×)**. (3) 스트레스
60런×8세대 478 적용: 과생성 0, **적용 최대 비율 1.15×→1.0×**(부호 교정 35건이
would-be 팽창을 재분배로 전환해 아무 이동도 예산 근처조차 안 감), **적용 시점 budget
게이트 발동 16→0회**, selfX/breaks/closed 0. budget 게이트·budgetMaxAngle은 이제 진짜
최종 안전망(정상 사용에서 발동 0). 실제 UI: 이전 3× 팽창하던 허리+진동 조합이 깔끔한
2다트 분산으로 렌더. 캐시 버전 `?v=2026070724`.

**남은 것**: 뒤판(pivot=E) 부호 교정도 공용 경로라 함께 타지만 뒤판 중심 검증 아직.

### 후속 재설계 (2026-07-08) — `chooseConservingSign` → `chooseSignedBaseAngle`

**증상**: 다중다트 상태에서 조각을 선택하면 "회전할 공간이 없습니다"가 자주 떴다.
실측: 3다트 상태의 no-room 65건 중 **51건(78%)이 오차단**(반대 부호엔 회전 공간이
있는데 놓침).

**근본 원인**: 위 `chooseConservingSign`이 부호를 **full 각도에서 `sumOpenDartAngle`을
재서** 골랐는데, full 각도에선 **두 부호 다 자기교차하는 "쓰레기 형상"**이라 총합이
무의미했다. 그 잘못된 총합으로 부호를 골라, 실제로 회전 공간(findMaxSafeAngle>0)이
있는 반대 부호를 놓치고 no-room으로 오차단했다. (부호 교정 아이디어 자체는 맞았지만
"측정 지점"이 틀렸다.)

**수정 (`chooseSignedBaseAngle`, `chooseConservingSign` 대체)**: 부호를 total로 고르지
않고, **두 부호(+/−)를 각각 실제 파이프라인 `findMaxSafeAngle → budgetMaxAngle`까지
통과시켜 "사용 가능한 각도"를 구하고, 그 값이 큰 부호를 선택**한다. 이러면:
- 팽창 부호 → `budgetMaxAngle`이 예산 넘는 지점에서 잘라 작아짐 → 짐 (다트량 보존).
- 회전 공간 없는 부호 → `findMaxSafeAngle`이 0으로 잘라 짐 → 반대 부호에 공간 있으면
  자동 선택 (no-room 오차단 회복).
- 둘 다 0 → 진짜 no-room (정상 차단). 동률이면 기하 부호 유지.
selectPiece는 이제 `choosePhysicalCloseAngle(부호 후보) → chooseSignedBaseAngle`
(내부에서 findMaxSafe+budgetMax를 두 부호에 대해 수행)로 단순화. **크기(θ)는 불변,
BP 각도만 사용.** 한 문장: **부호를 "총합"이 아니라 "파이프라인 통과 후 사용 가능
각도"로 고른다.**

**검증(실제 patched applyDartMove)**: 3다트 상태 no-room **65→22건(33%→11%)**,
적용 가능 129→172건. 스트레스 60런×8세대 478 적용: 과생성 0, 적용 최대 비율 1.0×,
selfX/breaks/closed 0. 콘솔 오류 0. 캐시 버전 `?v=2026070725`.

**남은 것**: 남은 no-room 22건은 양쪽 부호 다 즉시 자기교차하는 진짜 불가 위치(정상
차단). 뒤판 중심 검증은 여전히 미완.

### findMaxSafeAngle 델타 전환 시도 → 폐기 (2026-07-08) — 다음에 재시도 금지

**시도**: `findMaxSafeAngle`의 회전 한계 판정을 `findRotationCollisions`(고정×회전 조각
쌍)에서 **적용 게이트와 같은 bake-delta 자기교차 기준**(`bake(θ)→normalize→
findSelfIntersections`가 각도0 기준선보다 늘면 unsafe)으로 단순 교체. 동기: 실측에서
`findRotationCollisions`가 실재하지 않는 겹침을 신고하는 거짓 양성(rotColl>0인데 실제
bake 자기교차=0)이 있어 일부 다중다트에서 과소회전("여유 있는데 회전 못함")이 났음.

**결과: 실패 → 되돌림.** 첫 다트 기본 케이스(front-waist/side-seam/front-center 등)가
**18.2° → 1.3°로 과소회전**(findRotationCollisions 기준 18.2° vs 델타 기준 1.3°, 실측
확인). 원인: 델타-bake **경로 스캔**이 **회전 중 일시적으로 나타나는 접선 노이즈**
(각도0엔 없다가 θ>0에서 진동하부 곡선이 옆선에 스침)를 "새 자기교차"로 오판해 첫
다트를 캡함. **이건 2026-07-07에 `findSelfIntersections(bake)`를 버리고
`findRotationCollisions`로 간 바로 그 이유** — 델타 게이트는 끝점만 봐서 접선 노이즈를
피하지만, findMaxSafeAngle은 경로 전체를 스캔해야 해서(중간에서만 생기는 겹침 때문)
접선 노이즈에 취약하다.

**결론: `findRotationCollisions`를 델타-bake로 단순 대체하면 안 된다.** 두 기준은 정반대
실패 모드다 — findRotationCollisions=일부 다중다트 거짓 양성(과소회전)이지만 첫 다트
정확, 델타-bake=다중다트 정확이지만 첫 다트 회귀.

**다음 설계 후보(둘 다 단순 swap이 아니라 별도 설계)**:
1. **하이브리드**: `findRotationCollisions` 결과를 1차로 쓰되, 그게 캡한 각도를 bake-delta로
   사후 검증해 **거짓 양성만 제거**(실제 bake 자기교차가 안 늘면 캡 연장). 중간 경로의
   진짜 겹침은 findRotationCollisions가 계속 잡음.
2. **graze-허용 델타**: bake-delta에 `findSelfIntersections`의 graze/junction 허용
   (GRAZE_EPS_JUNCTION 등)을 회전 스윕 중 접선에도 적용해 접선 노이즈를 걸러냄.

**현재 방침**: 실사용 테스트 우선. chooseSignedBaseAngle(beefede)로 no-room 대부분
해소됐으므로, findRotationCollisions 거짓 양성의 잔여 과소회전이 **실사용에서 실제로
거슬리는 수준으로 확인될 때** 위 하이브리드/graze-델타를 별도 설계로 진행.

## "발견 5" 하이브리드 델타 재검증 구현 (2026-07) — 위 하이브리드 후보 1번 실현

**증상**: 드래그 UI가 "여기까지 안전합니다"(예: 18.25°, 풀)라고 baseAngle을 내주는데,
그대로 적용 버튼을 누르면 "패턴이 겹칩니다"로 거부되는 경우가 있었다(실측: 1다트
100% 소진 상태에서 2번째 다트를 시도하면 `chooseSignedBaseAngle`은 -18.25°가
findRotationCollisions 기준 충돌 0건이라 안전 판정했지만, 실제 bake의
`findSelfIntersections`는 새 자기교차 1건을 찾아 적용 게이트가 거부함).

**원인**: `findMaxSafeAngle`(사전선택, `findRotationCollisions` 사용)과
`applyDartMove`의 최종 델타 게이트(`findSelfIntersections` 사용)가 **같은 bake·같은
각도에서 다르게 판정**할 수 있다 — 두 함수가 겹침을 보는 방식이 다르기 때문.

**수정 (`applyTimeSafeAngle` 신설, 하이브리드 후보 1번)**: `findMaxSafeAngle`
자체(=`findRotationCollisions` 경로 스캔)는 **전혀 안 건드림** — 위 시도-폐기
섹션에서 확인했듯 전면 델타 교체는 첫 다트 과소회귀(18.25°→1.3°)를 재현한다.
대신 `chooseSignedBaseAngle`이 이미 고른 **최종 후보각 한 값**만 사후 재검증:
- 기준선은 적용 게이트와 동일하게 **이동 전 저장 형상**(`prevBakedSegments`,
  각도0 재조립 아님 — 그건 항등이 아니라서 예전에 게이트가 오염됐던 전례가 있다).
- 후보각이 통과하면 그대로 반환.
- 실패하면 `[0, 후보각]`(=이미 collision-safe로 확인된 범위) 안에서 델타 게이트를
  통과하는 최대각을 18회 이분 탐색으로 찾는다.
- **`crossesAt(0)` 자체가 이미 실패하는 예외 케이스**(split 재구성만으로 저장
  기준선 대비 노이즈가 생기는 드문 경우, 실측 373건 중 6건): 이분 탐색이 기댈
  안전한 하한이 없으므로 **0을 반환해 정직하게 차단**한다(호출부 MIN_DART_ANGLE_RAD
  체크가 "회전할 공간이 없습니다"로 안내). 처음엔 "원래 후보각 그대로 반환"으로
  완화 처리했으나, 그 값도 결국 applyDartMove에서 거부되는 걸 실측으로 확인하고
  0 반환으로 교정 — "늦게 조용히 실패"보다 "일찍 정직하게 차단"이 이 안전망의 목적.
- selectPiece 파이프라인: `choosePhysicalCloseAngle → chooseSignedBaseAngle →
  applyTimeSafeAngle → (MIN 체크)`.

**검증**:
1. **첫 다트 회귀 없음**: front-waist/side-seam/front-center 3곳 모두 여전히
   풀 18.25°(축소 없음) — 전면 델타 교체가 냈던 1.3° 회귀 재현 안 됨.
2. **원 재현 케이스 해소**: 1다트 100% 소진 → 2번째(진동상부) 시도 —
   수정 전: `chosenAngleDeg:-18.25` → `applyDartMove()` **거부**(패턴이 겹칩니다).
   수정 후: `chosenAngleDeg:-0.752` → `applyDartMove()` **성공**(적용 완료 0.3cm).
3. **스트레스 (50런×8세대, 400세대 실행)**: 수정 전 파이프라인이라면 거부됐을 후보
   53건 확인(비교용 dry-run) → 수정 후 **실제 적용 시점 거부 0/400**(crossesAt(0)
   예외 처리 전엔 6/373 잔존 → 0 반환 교정 후 0/400). selfX/breaks/closed 전부 0,
   과생성 0, maxRatio 1.15(정상 상한 이내).
4. 실제 UI 2다트(허리 풀+진동 0.3cm) 렌더 확인, 콘솔 오류 0.

캐시 버전 `?v=2026070727`.

**남은 것(1차 시점)**: findRotationCollisions 자체의 거짓 양성은 여전히 남아있다 —
1차 수정은 "그 거짓 양성이 최종 후보각에 실제로 영향을 준 경우"만 사후에 걸러낸다.
또한 1차의 단순 `[0, 후보각]` 이분 탐색은 **비단조 안전 구간을 놓칠 수 있다**는
한계가 이후 드러남 → 아래 2차 재설계로 해결.

### "발견 5" 2차 재설계 (2026-07) — 스캔+마지막경계 이분탐색, 부호 선택에 델타 반영

**1차의 숨은 결함**: `applyTimeSafeAngle`의 단순 `[0, 후보각]` 이분 탐색은 "0이
안전하면 그 위는 단조롭게 안전→불안전으로 갈린다"고 가정했는데, 이건 정확히
`findMaxSafeAngle` 자신의 주석이 경고하는 비단조 자기교차(회전 경로 중간에서만
생겼다 사라짐) 문제에 그대로 걸린다. 실측: 원 재현 케이스(1다트 100% 소진 → 2번째
진동상부 시도)에서 1차 알고리즘은 **0.752°**(0 근처의 좁은 안전 구간)만 찾았는데,
사실 candidate(18.25°)에 가까운 쪽에 **훨씬 넓은 안전 구간(18.06°)**이 따로
있었다 — 단순 이분 탐색이 이걸 완전히 놓쳤다.

**수정**:
1. **`applyTimeSafeAngle` 재작성**: `[0, candidate]`를 40스텝으로 촘촘히 스캔해
   **가장 큰(candidate에 가장 가까운) 안전 지점**을 찾고, 그 지점과 바로 다음
   (불안전이 확인된) 스텝 사이만 18회 이분 탐색으로 정밀화한다
   (`findMaxSafeAngle`의 SCAN_STEPS+이분탐색 관례와 동일 패턴).
2. **`crossesAt(0)`이 실패해도 즉시 포기하지 않음**: 스캔을 끝까지 계속해
   candidate 쪽의 더 넓은 안전 구간을 찾을 기회를 준다. **스캔한 41개 지점
   전부가 실패했을 때만** 0을 반환(정직한 차단) — "일부만 보고 포기"에서
   "전 구간 확인 후 판단"으로 전환.
3. **부호 선택 자체에 델타 게이트를 반영**: `chooseSignedBaseAngle`이 새
   `prevBakedSegments` 인자를 받아, 각 부호(+/−)마다 **`findMaxSafeAngle` →
   `budgetMaxAngle` → `applyTimeSafeAngle` 전체 체인**을 통과시킨 "최종 적용
   가능 각도"끼리 비교해서 큰 쪽을 선택한다(예전엔 `findMaxSafeAngle`+
   `budgetMaxAngle`까지만 보고 부호를 정한 뒤 `applyTimeSafeAngle`은 별도
   후처리였음 — 이제 부호 선택 단계부터 "실제로 적용까지 되는 쪽"을 고른다).
   selectPiece 호출부도 `chooseSignedBaseAngle(..., _prevBakedForSide)` 한 번으로
   단순화(별도 후처리 블록 제거).

**검증**:
1. **120단계 brute-force oracle과 비교**: 원 재현 케이스의 두 부호 각각에서
   `applyTimeSafeAngle` 결과와 독립적인 120스텝 오라클(같은 알고리즘을 촘촘한
   해상도로 재구현, 이분탐색 없이 격자값 그대로) 사이 오차 **0.016°/0.035°,
   전부 0.1° 이내**.
2. **첫 다트 회귀 없음**: front-waist/side-seam/front-center 3곳 모두 여전히
   풀 18.25°.
3. **원 재현 케이스 — 더 큰 안전 구간 발견**: 수정 전(1차) 0.752° →
   **수정 후(2차) 18.06°**(candidate 18.25°의 99% — 비단조 때문에 놓쳤던 훨씬
   넓은 구간을 정확히 찾아냄).
4. **스트레스(40런×6세대, 240세대 실행)**: 적용 240/240, **apply 시점 거부
   0/240**, selfX/breaks/closed 전부 0, 과생성 0, maxRatio 1.15(정상 상한 이내).
5. 실제 UI 2다트 적용 확인(허리 풀 + 진동 재분배), 콘솔 오류 0.

캐시 버전 `?v=2026070728`.

**남은 것**: findRotationCollisions 자체의 거짓 양성(하이브리드 후보 2번,
graze-허용 델타로 findRotationCollisions 자체를 고치는 것)은 여전히 미착수 — 이번
수정은 "그 거짓 양성이 최종 후보각/부호 선택에 실제로 영향을 준 경우"만 걸러낸다.
커밋 완료 (`c7457dc` Align dart preview with apply-time safety).

## dartId 귀속 전수조사 — latestDartId 규칙의 "오래된 다트 영구 동결" 증명

**의심**: `splitBakedOutline`(js/dartMove.js:714-725)의 "가장 최근 dartId만 예외,
나머지는 fixed/rotate에 걸치면 통째로 rest(항상-고정)로 강제 편입" 규칙이, 젤리/물
지배 원칙("현재 형상은 하나, 다트 간 최근/과거 위계 없음")과 충돌하는지 확인 요청.

**전수조사 방법**: 2다트(모두 열림, 부분 회전) 실제 상태를 만든 뒤, **클릭 가능한
외곽선 세그먼트 58개 × 세그먼트당 3개 지점 × 조각선택 A/B 2가지 = 268개 유효 조합
전부**(cutBlocked 40건 제외)에 대해 `splitBakedOutline`을 직접 호출해, 오래된
dartId(dart1)와 최신 dartId(dart2)가 각각 fixed에만/rotate에만/양쪽 걸침(spanned,
=전달가능)인지 전부 표로 만들었다.

| dartId | spanned(전달가능) | fixedOnly | rotateOnly | neither |
|---|---|---|---|---|
| **dart1 (오래됨)** | **0 / 268** | 268 | 0 | 0 |
| dart2 (최신) | 91 / 268 | 177 | 0 | 0 |

**증명 완료**: 268개 조합(가능한 컷 위치·조각선택의 사실상 전수) 중 **단 하나도
dart1을 spanned로 만들지 못했다**. dart1은 어느 세그먼트를 클릭하든, 어느 조각을
고르든 항상 fixed 쪽에만 있다 — **오래된 다트는 새 다트가 하나라도 더 생기면 그
순간부터 영구 동결되며, 그 뒤로 어떤 컷/조각 조합을 시도해도 절대 다시 열리지
않는다.** latestDartId 규칙이 만드는 벽은 확률적 경향이 아니라 이 토폴로지에서
**수학적으로 100% 확정적**이다.

**메커니즘**: `splitBakedOutline`의 forward/backward 걷기는 새 cutPoint에서 각
방향으로 **처음 만나는 pivot 접점 세그먼트(=가장 가까운 기존 다트 다리)에서
무조건 멈춘다**(714행 이전 로직). 즉 어느 방향으로 걷든 "그 방향에서 가장 가까운
다트"보다 먼 다트에는 절대 도달하지 못한다 — 이건 recency와 무관한 순수 위상
성질이다. 문제는 그 다음: 이렇게 자연스럽게 도달한 다트가 "최근 것"이 아니면
`forceRest`가 통째로 rest로 밀어버린다(722행 `if (dartId === latestDartId) continue;`).
**즉 위상(walk)이 이미 "이 다트를 건드려도 된다"고 정확히 계산해준 걸, recency
체크가 뒤집어 없애버린다.**

### topology 기반 split 재설계안 (보고만, 코드 수정 없음)

**원칙 제안**: recency(`latestDartId`) 기준을 폐기하고, **"현재 이 컷의
forward/backward walk가 실제로 도달한 dartId"를 그대로 예외 대상으로 인정**한다.
walk는 이미 "가장 가까운 다트가 어느 것인가"를 정확히 계산하므로, 별도의 recency
장부가 필요 없다 — recency는 위상과 무관한 부기(bookkeeping) 개념이고, 위상이
이미 옳은 답을 갖고 있다.

**두 가지 경우**:
1. **Case A (같은 다트, forward·backward가 같은 dartId에서 멈춤)**: 오늘 latest에서
   이미 하는 것과 정확히 같은 동작(그 다트를 열고 닫는 재분배)을 dartId 무관하게
   허용. `bakeFromSplitPieces`의 trailing 재사용 메커니즘(`_tailReachesPivot`)은
   이미 dartId를 안 가리고 순수 기하(pivot 도달 여부)만 보므로(469-488행 부근),
   **다운스트림 bake 로직 자체는 이미 dartId-무관일 가능성이 높다** — 막고 있는
   건 순전히 splitBakedOutline의 force-rest 한 줄이다.
2. **Case B (다른 다트 두 개, forward가 dart X, backward가 dart Y에서 멈춤)**:
   cutPoint가 서로 다른 두 다트의 입 사이에 위치하는 경우. 오늘의
   `bakeFromSplitPieces`는 "새 다트 하나 + trailing 최대 하나"만 상정하고
   설계됐다 — 양쪽에서 서로 다른 기존 다트 하나씩과 동시에 상호작용하는 건
   현재 재구성 로직이 처리하도록 만들어지지 않았다. 이번 268개 조합 조사에서
   Case B가 실제로 발생하는지까지는 이번 세션에서 분리 확인하지 못했다(다음
   조사 필요) — dart2가 fixedOnly로 나온 177건 중 일부는 Case B일 수 있다.

**권고 (단계적 접근)**:
- **1단계(작음)**: force-rest 조건을 "latestDartId가 아니면"에서 "이번 컷의
  forward/backward walk가 그 dartId에 실제로 도달했는지"로만 바꾸고, **Case A만
  허용**(forward·backward가 같은 dartId에서 멈춘 경우만 spanned 인정). Case B는
  지금처럼 force-rest 그대로 유지(막힌 채로 둠, 회귀 없음 보장).
  이러면 "오래된 다트라도 새 컷이 그 다트 하나만 정확히 겨냥하면 재분배 가능"해져서
  영구 동결의 상당수가 풀릴 것으로 예상되지만, **아직 검증 안 됨** — 특히
  2026-07-02/03에 이 force-rest 규칙이 원래 고치려던 "다리 쌍 분리로 인한 찢어짐"
  버그가 non-latest dartId에서도 안전한지 반드시 재검증해야 한다(당시 회귀 재현
  케이스로 회귀 테스트 필수).
- **2단계(큼, 별도 설계)**: Case B(서로 다른 두 다트 사이 컷) 지원 — `legOld` 생성
  로직을 "새 dartId 하나"가 아니라 "양쪽에서 만난 실제 dartId 두 개까지" 다루도록
  일반화. 이건 `bakeFromSplitPieces`의 legOut/legIn/legOld 조립 전체를 다시 설계해야
  하는 범위라 별도 세션 필요.

**이번 세션 결론**: 코드 수정 안 함. 1단계 제안은 유망해 보이나 **아직 실측 검증
전이므로 다음 작업으로 넘김** — 착수 승인 주시면 1단계부터(Case A만, Case B는
그대로 차단) 최소 변경으로 시도하고, 2026-07-02/03 회귀 케이스 재검증을 최우선으로
하겠음.

## splitBakedOutline 3차 재설계 — notch-instance 기반, Case B 차단 폐기 (2026-07)

위 1단계 제안(Case A만 허용, Case B 차단)을 실제로 구현했다가, 2세대 실측에서 **각도
계산이 없다는 결함**을 발견하고 즉시 3단계로 확장했다. 세 단계 전부 코드에 남아있고
CLAUDE.md에 순서대로 기록한다(다음 세션이 같은 시행착오를 반복하지 않도록).

### 2차 시도 — notch instance 판정만 (각도는 그대로 rawBase)

`splitBakedOutline`의 dartId 그룹 판정을 notch-instance 그룹 판정으로 교체:
forward/backward가 "같은 notch instance"에 도달하면 Case A(허용), "서로 다른
instance"에 도달하면 Case B(차단, 둘 다 rest로 강제 편입). latestDartId 개념은
완전히 제거(위상만으로 판정).

**실측 결과 — Case A/B 판정 자체는 정확했다**: 2다트 상태에서 오래된 dart1의
notch를 정확히 겨냥한 3번째 시도가 `forwardBoundaryIdx`로 정확히 dart1의 notch를
찾아냈다. 그런데 **결과가 dart1이 아니라 dart2를 건드렸다** — 원인: Case A로
인정됐어도 회전각을 여전히 rawBase(18.25°)로 시도했기 때문에, dart1의 legA만
rotate에 든 상태에서 18.25° 회전하면 legA가 반대쪽 legB(9.125° 거리)를 훌쩍
지나쳐버려 `findMaxSafeAngle`이 거의 즉시(0.003°) 충돌을 감지해 캡함 → A 조각이
사실상 무력화되고 B 조각(dart2 방향)만 살아남아 선택됨.

**교훈**: notch-instance **판정**은 위상만으로 정확히 되지만, **회전각의 크기와
부호도 그 notch에 맞춰 다시 계산해야** 실제로 닫힌다. 판정과 각도는 별개 문제였다.

### 3차 시도 — source notch 기반 각도 계산 + Case B 차단 폐기 (현재)

**설계 변경**: Case B를 "차단"하지 않고 "허용"으로 바꿨다. forward가 도달한 notch는
pieceA의 회전에만, backward가 도달한 notch는 pieceB의 회전에만 관련이 있다 —
사용자가 둘 중 하나만 회전 조각으로 선택하므로, 선택 안 된 쪽 notch는 회전과
무관하다(고정된 채 안 움직임). "서로 다르면 차단"할 이유가 없었다.

- `splitBakedOutline`이 `pieceA.sourceNotch = forwardNotch`,
  `pieceB.sourceNotch = backwardNotch`를 각각 태깅(force-rest 완전 제거, 위상 계산
  결과 그대로 사용). 각 sourceNotch는 `{movingMouth, targetMouth, signedAngleRad,
  apertureRad}`를 담는다 — movingMouth를 pivot 중심으로 signedAngleRad만큼 돌리면
  정확히 targetMouth에 도달한다(이 엔진의 모든 회전이 같은 pivot 중심이라 두 mouth는
  항상 같은 반지름 — 각도만 맞으면 정확히 겹침, 이 불변식이 정밀 닫힘을 보장).
- selectPiece: `rotatePiece.sourceNotch`가 있으면, **회전각을 rawBase가 아니라 그
  notch의 `signedAngleRad`에서 직접 유도**(부호+크기 모두 analytically 결정,
  두 부호를 "시도"하지 않는다 — 반대 부호는 그 notch를 여는 방향이라 애초에 후보가
  아님). `baseMagnitude = min(sourceAperture, budget)`, 그 다음 findMaxSafeAngle
  (collisionLimit) → budgetMaxAngle(budgetLimit) → applyTimeSafeAngle(적용시점
  델타)로 순서대로 캡. sourceNotch가 없으면(gen-0/완전히 새 위치) 기존처럼 rawBase
  + choosePhysicalCloseAngle + chooseSignedBaseAngle 경로 그대로.

**검증(실제 patched 파이프라인, 2다트 상태에서 가장 오래된 dart1을 3번째로 재겨냥)**:
- **풀 회전**: dart1의 notch(9.125°)가 **정확히 0으로 닫히고**, cutPoint 근처에
  **정확히 9.125°인 새 notch**가 열림. 무관한 dart2의 두 notch(4.563°, 4.562°)는
  **완전히 무변화**. 총합 18.25°→18.25°(오차 0). openCount 3→3(순증가 0).
- **부분 회전(40%)**: source 잔량 5.475° + new 3.65° = **9.125°(sourceBefore와
  정확히 일치)**. openCount 3→4(+1, 정확히 요구된 범위).
- **B 선택(backward notch)**: 대칭적으로 동일 — 4.562°→정확히 -4.562°로 닫힘.
- breaks/selfX/closed **전부 0** (풀·부분·A·B 전 케이스).
- 첫 다트 회귀 없음(3곳 모두 여전히 18.25°, `sourceNotch` 없음 확인 = gen-0 경로
  정상 진입).
- **무작위 스트레스 25런×5세대(125세대 실행)**: 적용 125/125, **maxRatio 1.00**
  (기존 chooseSignedBaseAngle 방식의 1.15 허용폭 없이 **항상 정확히 예산 보존** —
  sourceNotch 기반 각도가 근본적으로 더 정확하기 때문), selfX/breaks/closed 전부 0,
  적용 시점 거부 0건.
- 실제 UI 렌더 확인, 콘솔 오류 0.

**한 문장: "오래된 다트를 다시 열 수 있는가"라는 위상 문제는 2차에서 풀렸고,
"정확히 그 다트만 닫히는가"라는 각도 문제는 3차에서 풀렸다 — 판정과 계산은 항상
분리해서 검증해야 한다.**

캐시 버전 `?v=2026070730`. 커밋 완료 (`383c59a` Transfer darts by current source notch topology).

**남은 것**:
- 2026-07-02/03 원본 회귀의 **정확한 재현 절차**(구체적 클릭 좌표 시퀀스)는 당시
  기록에 남아있지 않아 이번 세션은 대신 광범위 무작위 스트레스(breaks/selfX/closed
  전부 0)로 그 버그 클래스를 검증했다 — 이걸 "재현 성공"으로 볼지, 정확한 원본
  시나리오를 별도로 찾아 재검증할지는 판단 필요.
- 뒤판(pivot=E) 검증 아직 — 공용 경로라 함께 타지만 뒤판 중심 스트레스는 미완.
- `notchInstances`/`buildSourceNotch`가 매 `splitBakedOutline` 호출마다 O(nn) 스캔을
  도는데, `applyTimeSafeAngle`의 40스텝 스캔과 결합하면 무거운 무작위 스트레스
  (예: 50런×8세대)에서 30초 타임아웃을 겪었다(이번 세션 25런×5세대로 축소해서 확인).
  실사용(사람이 한 번씩 클릭)에선 문제 없지만, 대규모 자동 회귀 테스트를 CI화하려면
  성능 최적화가 필요할 수 있음.

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

## 디버그 플래그 (2026-07 정리)

- `DEBUG_DART_MOVE = false` — `index.html`에 기본값. 필요할 때만 `true`로 켠다.
- `dartMove.js`의 모든 진단 로그는 **`dbg(...)` 한 함수로 통합**(파일 상단,
  `debugCheckSegmentContinuity` 바로 앞). `DEBUG_DART_MOVE`가 false면 전부 무음 —
  로그를 추가할 때도 `console.log`/`console.warn`을 직접 쓰지 말고 `dbg(...)`를 쓴다.
  단, `dbg(...)`도 인자 표현식은 호출 전에 먼저 평가되므로, map/filter/join처럼
  무거운 로그 데이터는 `if (DEBUG_DART_MOVE) { ... }` 가드 안에서 계산한 뒤
  `dbg()`를 불러야 한다(가드 없이 넘기면 꺼져 있어도 매번 순회 비용이 든다).
- `[pivotCheck]`/`[cutSegCheck]`/`[splitBaked piece summary]`/`[splitBaked pieceA/B pts]`/
  `[bake old-leg check]`(전부 "TEMP DEBUG, 원인 확정되면 제거"로 표시돼 있던 것들)는
  뒤판 검증(위 "헤드리스 회귀 테스트 하네스" 섹션, 128/128+600세대)으로 안정성이
  충분히 확인돼 **전부 삭제 완료**. 나머지(`[splitBaked]`, `[notchInstanceTag]`,
  `[apply]`, `[closeAngle]`, `[afterBake]` 등)는 `dbg()`로 남겨둠 — 필요하면
  `DEBUG_DART_MOVE=true`로 다시 켜서 볼 수 있음.
- `DEBUG_COLORS` — 앞/뒤판 색상 구분 렌더링 (변경 없음)

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
- `dartDriver.js`: `initDartMoveClickHandler`의 클릭 로직(1944-2038행)을 DOM 이벤트
  없이 재현하는 얇은 오케스트레이션(`attemptDartMove`) — 각도/충돌/예산 판단은
  전부 실제 함수 호출 결과이고, 이 파일 자체는 판단 로직을 재구현하지 않는다.
- `backDeterministic.js`: 결정론적 시나리오 매트릭스(아래 참고).
- `backRandomStress.js [runs] [gens]`: 기존 방법론(N런×G세대 무작위) 그대로, 인자로
  런/세대 수 조절.
- 실행: `node test/harness/backDeterministic.js`, `node test/harness/backRandomStress.js 60 10`.

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

## 다음에 확인할 것 (열려있는 이슈)

- **✅ (완료, 2026-07-08) `normalizeBakedSegments`** — 위 "normalizeBakedSegments 구현"
  섹션 참고. 파이프라인 `cut→rotate→bake→normalize→validate→render`, 단일 불변식
  (면적 0 서브패스 제거), ε=0.05cm 실측 확정, 다중다트 보존 검증 완료.
- **(다음 작업 후보) split/bake 아티팩트 근본 제거** — normalize는 사후 청소만 한다.
  `bakeFromSplitPieces`가 닫힌 흔적을 재분할로 재개방하는 것 자체를 막으려면
  split/bake가 열린 다트를 강체로 이고 가도록 재설계. 의도적 3개+ 다중다트 부채꼴
  워크플로우가 필요해지면 착수.
- **✅ (완료, 2026-07) 뒤판(back) 스트레스 검증** — 위 "헤드리스 회귀 테스트 하네스"
  섹션 참고. 결정론적 128/128 PASS + 무작위 600세대 이상 없음. back-shoulder-dart
  비대칭 잔여 sliver(~0.1cm)는 사용자 확인 결과 버그 아님(아래 항목 참고).
- **(신규 기능 후보, 다트이동과 별개 단계) 뒤어깨선 재봉선 정리 + 앞/뒤 어깨 길이
  맞춤** — 실제 패턴 작업에서 뒤판 다트이동 후 패턴사가 bSNP-bSP를 직선으로
  재작도하고 앞어깨 길이와 비교해 bSP를 조정하는 단계. 위 "뒤판 검증" 소견의
  sliver는 이 단계가 구현되면 자연히 흡수된다 — 다트이동 엔진 자체를 건드릴
  필요는 없음.
- 위 "알려진 사소한 관찰" 항목이 실제로 문제가 되는지 지켜보기
- **✅ (완료, 2026-07) 디버그 로그 정리** — 위 "디버그 플래그" 섹션 참고. TEMP DEBUG
  전수 삭제, 나머지는 `dbg()` 한 함수로 통합, `DEBUG_DART_MOVE` 기본 `false`,
  캐시 버전 `?v=2026070732`. 실제 브라우저에서 뒤판 다트이동 재검증 완료(콘솔 오류 0).
- (장기) 파일 분리, class화는 여전히 보류 상태 — 엔진이 충분히 안정된 뒤 재논의
