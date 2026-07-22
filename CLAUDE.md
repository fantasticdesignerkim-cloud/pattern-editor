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
  - 예외 기록: 2026-07-16 데이터 가져오기 기능(`storage.js` + `index.html` UI 1행)은
    사용자 승인 하에 추가함 — 환경 이전에 필요했다.
  - 예외 기록: 2026-07 캔버스 중심 UI 개편은 승인 하에 `index.html`(마크업 재배치·
    inline 색 제거·캐시 버전)과 `css/style.css`를 수정함. **JS는 무변경**
    (아래 "캔버스 중심 UI 개편 완료" 섹션의 불변식 준수).

## 개발 서버 / 실행

- 헤드리스 회귀: `node test/harness/runAll.js` (저장소 루트에서)
- 브라우저 확인: `.claude/launch.json`이 저장소 루트를 `python3 -m http.server 8420`으로
  서빙한다(맥 기준). 윈도우에서 `python3`가 없으면 `python`으로 바꿔야 한다.

## 작업 스타일 / 워크플로우

- **이론/계획 먼저 → 계획 보고 → 명시적 승인 대기 → 그 다음 코드 수정.**
  "코딩하지말고"라는 말은 문자 그대로 코드를 짜지 말라는 뜻.
- 원인이 명확하고 신뢰가 쌓인 패턴(예: disabled 보존 같은 단순 수정)은
  확인 절차를 줄여서 토큰 효율을 높여도 됨.
- 런타임 데이터(콘솔 로그, 스크린샷)가 이론적 분석보다 우선. 확신이 안 서면
  추측하지 말고 진단 로그부터 추가해서 실측.
- **반복 패치가 계속 어긋나면 멈추고 클린 스펙에서 재설계.** 패치 위에 패치를
  쌓지 않는다.
- **작업 환경: 맥북 (2026-07-16부터 주 환경).** 이전엔 윈도우 사무실(GitHub Desktop) +
  맥 집(Git CLI) 병행이었으나 맥으로 이전함. 윈도우 PC의 작업물은 `3816945`까지 전부
  origin/main에 푸시 완료.
- 파일 전달: Claude가 수정된 파일을 통째로 전달 → 김이 GitHub 폴더에 교체 →
  `index.html`의 버전 쿼리스트링(`?v=...`) 갱신 → 하드 리프레시 (브라우저 캐시
  문제 자주 발생하므로 매번 확인)

### ⚠️ 진동선 데이터는 git으로 따라오지 않는다 (환경 이전 시 필수)

`state.armH`(진동선 앵커/핸들), `fArmH`/`bNeckH`/`fNeckH`, `sleeveH`는 **브라우저
localStorage에만** 저장된다 — 저장소엔 없다. 그래서 PC/브라우저를 옮기면 **같은 치수여도
곡선이 달라져 도안 자체가 달라진다.** 2026-07-03 #7의 "어쩔 때는 맞고 어쩔 때는 틀리다"가
정확히 이 데이터 차이였다. **헤드리스 하네스는 localStorage를 안 쓰므로 골든은 그대로
통과한다 — 테스트는 초록인데 UI 결과만 다른 상황이 생길 수 있다.**

- localStorage 키는 **두 개**이고 저장 시 **양쪽 모두** 쓴다:
  `armhole_data`(append-only 배열, 내보내기 형식) / `armhole_data_kv`(치수키 `B-W-BL`별
  최신 1건). `getSavedCurveEntries()`는 kv를 **먼저** 읽고 `updateSaveCount()`는 kv만
  센다 — kv가 비면 데이터가 있어도 "저장 0건"으로 보인다.
- **이전 절차**: 옮기기 전 브라우저에서 `데이터 내보내기 → JSON 다운로드`로 **그 시점
  최신** 데이터를 받고(자동저장이 계속 갱신하므로 예전 파일은 낡았을 수 있다), 새 환경에서
  `데이터 가져오기 → JSON 불러오기`(2026-07-16 신설, `importDataFromFile`/
  `importCurveEntries`)로 복원한다. 두 키를 모두 복원하고, 현재 치수와 맞는 곡선이 있으면
  즉시 적용된다.
- 저장소 루트의 `armhole_data_*.json`은 그 내보내기 파일들이다(백업 겸 이전용).
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

## Dead code 감사 (2026-07 실측) — "The best part is no part"

**원칙(사용자 지침)**: 새 추상화·계층·캐시를 추가하기 전에 **지울 수 있는 부품이 없는지
먼저 찾는다.** 부품이 없으면 그 부품의 버그도, 동기화 비용도, 검증 부담도 없다.

전 파일(js/*, index.html) 참조 감사 결과 **프로덕션 참조 0인 함수 5개**:

| 함수 | 상태 |
|---|---|
| `pieceMouthPoint` | prod:0 / harness:0 — 완전 dead |
| `calcFrontCloseAngleByRotateHit` | prod:0 — `calcFrontBaseDartAngle`로 대체된 잔재 |
| `calcBackCloseAngle` | prod:0 — 상동 |
| `calcBackCloseAngleByRotateHit` | prod:0 — 상동 |
| `applyDartMoveToPoint` | prod:0 — `return orig` 스텁 |

**index.html의 dead UI**(삭제하려면 UI 수정이라 별도 승인 필요):
- `dartThetaRow` + `inpDartTheta` + `setDartTheta` — `display:none` 행 + 빈 스텁 함수.
  세 개가 서로만 참조하는 닫힌 고리(js/*에서 실사용 0).
- `chkRefDart` — 2026-07-07 렌더 통일로 **이미 무효**라고 이 문서에 기록돼 있는 체크박스.
  js/*에서 참조 0.

**착수 순서 제안**: `calc*CloseAngleByRotateHit` 3종은 `chooseSignedBaseAngle`과 같은
"부호를 추측하던 시절"의 잔재라 순서 ③에서 어차피 사라질 계보다 — **먼저 지우면 ③이
이고 갈 표면이 줄어든다.**

## 캔버스 중심 UI 개편 완료 (2026-07) — 사이드바 제거 · 밝은 블루프린트

> ⚠️ **이 섹션은 이력이다.** 아래 "컨텍스추얼 CAD workspace 채택"이 이 섹션의 UI 불변식
> 일부를 **명시적으로 대체**한다(좌우 상시 패널 금지 / workflow 단계 모델 금지 /
> 반응형 자동 착수 금지 3가지 폐기). 시각 체계·격자·저장 테스트 규칙은 계속 유효하다.

**결정**: 상시 좌우 패널을 없애고 **캔버스가 화면의 주인**이 된다. UI에도
"The best part is no part"를 적용한다 — 새 부품을 늘리지 않고 기존 부품의
위치·색·계층만 정리한다.

**구조 (확정)**
- 상단 **초슬림 도구 레일**(44px, 흰 배경 + 얇은 하단 경계) 하나. 좌우 상시 패널 없음.
- **치수 / 곡선 편집 / 보기 / 저장·데이터** = 네이티브 `<details>/<summary>` 팝오버.
  팝오버 제어 JS 없음(열림 상태는 DOM 속성 하나 — 새 상태 계층이 아니다).
- **다트이동은 팝오버가 아니라** 레일의 직접 진입 버튼(`btnDartMove`).
- 작업 중 정보(앞/뒤 선택·적용·리셋·힌트)는 레일 아래 중앙 **floating context strip**.
  `position:absolute` overlay라 캔버스 레이아웃 높이를 밀지 않는다.
  표시 계약 `.context-strip:has(#dartSideRow:not([style*="none"]))` 는
  `setSideRowVisible`(dartMove.js)이 쓰는 `display:""|"none"` 계약에 **얹혀 있을 뿐**
  새 JS·새 상태를 만들지 않는다.
- 색: navy=텍스트/브랜드, cyan=선택·활성, **orange=실행(패턴 생성·다트 적용)에만**,
  나머지 중립. 토큰 9개를 `:root`에 정의하고 같은 색을 반복 정의하지 않는다.
- **격자는 `render.js`가 만드는 SVG 격자 한 벌만 재사용**한다(`.grid-m`/`.grid-M`을
  블루프린트 색으로). **CSS 배경 격자는 만들지 않는다** — 두 벌이 되면 줌·이동에서
  어긋난다(실제로 한 번 중복 생성했다가 제거함).

**완료 커밋**

| 커밋 | 내용 |
|---|---|
| `97586c7` | 죽은 다트 UI 삭제(chkRefDart·dartThetaRow·setDartTheta 스텁) |
| `3de31c8` | 사이드바 제거 · 상단 도구 구조 재배치 |
| `5a29b67` | 밝은 블루프린트 시각 체계 |
| `969c683` | 기존 SVG 격자 재사용(CSS 격자 제거) |
| `fbb1c69` | 격자 대비(.09/.16) · CSS 캐시 버전 |

### UI 불변식 (위반 금지)

- **좌우 상시 패널을 다시 만들지 않는다.**
- 새 기능을 **상단에 평평하게 계속 추가하지 않는다.** 최상위 도구를 늘리기 전에
  **기존 팝오버·context strip 재사용**을 먼저 검토한다.
- **새 workflow 단계·완료 상태 모델 금지**(단계 표시줄·완료 체크·자동 진행).
  작업 순서는 기능 분류 참고일 뿐 제품의 상태 모델이 아니다.
- context strip 확장은 **현재 작업 상태가 실제로 부족하다는 사용 증거가 생겼을 때만**.
- 아이콘·애니메이션·반응형 재설계는 **자동 착수하지 않는다.**
- **JS가 설정하는 활성/취소 색상**(`setBtn`/`setSideActive`/`toggle*Edit`)은
  기능 상태 표시로 **그대로 둔다** — 중립화하려고 JS를 고치지 않는다.
- 재배치·재스타일 시에도 요소 **ID·onclick·입력 계약**을 보존한다(핸들러가 ID로 찾고,
  일부는 `if(el)` 가드 없이 접근한다). inline 색을 CSS로 덮을 때 `!important`를 쓰지 않고
  **inline을 제거하고 의미 class**(`action-primary` 등)를 쓴다.

### 저장 데이터 테스트 규칙 (사고 후 확정)

**사고 기록**: UI 검증 중 회귀 테스트가 실제 사용자 origin에서 `saveCurveData()`를
호출해 `armhole_data_kv`의 `83-64-38`을 **기본 산출 곡선으로 덮었다**. 격리 Node VM
재현으로 덮인 값이 "편집하지 않은 기본 곡선"임을 canonical byte-identical로 확인했고,
백업에서 복구했다.

- 실제 사용자 origin에서 **`save`/`import`/`autoSave`를 회귀 테스트로 호출하지 않는다.**
- 저장 기능 검증은 **빈 localStorage의 격리 origin**(`127.0.0.1:8420`은 `localhost:8420`과
  **다른 origin**) **또는 Node VM**에서만 한다.
- 검증 시작 전 **storage 0키를 확인**한다.
- **인앱 프리뷰 localStorage는 휘발성 테스트 저장소**로 취급한다(프리뷰 재시작에 사라질 수
  있음). 여기에 사용자 데이터를 복구·보관하지 않는다.
- **`armhole_data_2026-07-16.json`이 현재 권위 백업**이며 **미추적 상태로 보존**한다.
- 저장 관련 테스트 전에는 **먼저 snapshot을 확보**한다(원문 + timestamp 제외 canonical,
  각각 길이·hash 기록).

## 컨텍스추얼 CAD workspace 채택 (2026-07, 사용자 확정) — 위 UI 불변식 일부 대체

**지배 원칙**: "항상 모든 기능을 보여주는 UI가 아니라, **현재 작업에 필요한 기능만**
보여준다."

### 대체 관계 (위 "캔버스 중심 UI 개편 완료"의 불변식 중)

**폐기 (더 이상 따르지 않는다)**
- ~~좌우 상시 패널을 다시 만들지 않는다~~ → 좌 tool rail · 우 inspector를 **둔다**.
- ~~새 workflow 단계·완료 상태 모델 금지~~ → 상단 **stage bar를 둔다**(아래 제한 참고).
- ~~아이콘·반응형 재설계 자동 착수 금지~~ → 아이콘과 좁은 화면 대응을 **이번 범위에 포함**.

**계속 유지 (변함없음)**
- The best part is no part — 새 부품보다 기존 부품 재사용·정리를 먼저 검토한다.
- **엔진 변경과 UI 변경을 같은 커밋에 섞지 않는다.**
- **구현되지 않은 기능을 작동하는 척하지 않는다.**
- shape/perf 골든 변경 금지.
- 사용자 저장 데이터는 **격리 환경에서만** 테스트(위 "저장 데이터 테스트 규칙" 그대로).
- 시각 체계(navy/cyan/orange 역할, 토큰 9개)와 **SVG 격자 한 벌 재사용** 규칙 유지.

### 목표 레이아웃 (확정)

- 상단 **stage bar**: `DOROBO` + 정적 보조 문구 `문화식 원형`, 단계 `원형 / 디자인 /
  재단 / 출력`, 실행취소·다시실행·저장·파일·보기.
- 왼쪽 **contextual tool rail**: 현재 stage에서 쓸 수 있는 도구만.
- 중앙 **SVG canvas**(주인공). 상단에 몸판/소매·스냅·격자, 우상단에 맞춤/확대/축소.
- 오른쪽 **active-tool inspector**: 선택한 도구의 설정만. 고급 설정은 기본 접힘.
- 하단 **status bar**: 좌표·줌·스냅/격자·선택 상태, 작업 중일 때만 단계와 취소/적용.

### CAD workspace 불변식

- **stage는 수동 전환**이다. 자동 진행·완료 체크·진척도 모델을 만들지 않는다.
  (단계는 기능 분류이지 제품의 상태 머신이 아니다 — 이 제한은 폐기 대상이 아니다.)
- **현재 stage/tool에 필요한 기능만 표시**한다. 무관한 설정은 숨긴다.
- **미구현 기능은 disabled 또는 미노출**. 빈 inspector·가짜 수치·동작하지 않는 버튼 금지.
  - `재단`·`출력` stage = `disabled` + `aria-disabled="true"` + tooltip `준비 중`.
  - 절개·길이 측정·PDF 등 **구현체 없는 세부 도구는 완전 미노출**.
- **문서명 모델을 만들지 않는다**: 상단은 `DOROBO` + 정적 `문화식 원형`뿐. 가짜 파일명·
  저장 상태·동적 문서 상태 금지. 치수는 **원형 stage 설정에서만** 표시한다.
- **아이콘**: 외부 라이브러리·CDN 금지. 최소 **인라인 SVG**, 16~18px 단색 선형.
  모든 아이콘 버튼에 `aria-label`과 `<title>`. 장식용 아이콘 금지.
- **중앙 UI 함수 4개는 `js/ui.js` 한 파일**에 둔다 —
  `setWorkspaceStage(stage)` / `setActiveTool(tool)` / `updateContextInspector()` /
  `updateContextActions()`. **표시 제어만** 담당하고 **엔진 계산·형상 상태를 복제하지
  않는다.** 인라인 `<script>`로 구현하지 않는다.
- **동결 계약**: 엔진 로직(dartMove의 계산·split·bake·normalize·검증), SVG 좌표·크기·
  이벤트 좌표 변환, **기존 DOM ID**. 표시 제어는 여러 파일에 흩뿌리지 않고 `ui.js`로 모은다.
- 이벤트 리스너가 붙은 DOM을 `innerHTML`로 반복 재생성하지 않는다.
- 패널은 카드 반복 없이 **조용하고 밀도 높은 CAD 스타일**. 큰 제목·마케팅형 레이아웃·
  장식 그래디언트 금지.

### DOM 의존성 동결 근거 (S0 전수조사, id 34개)

ID를 바꾸지 않는 이유 — **가드 없이 접근하는 지점이 있어 제거·개명 시 즉시 예외**:
- `cv` — `state.js` 최상위 `const svg=getElementById("cv")`. **스크립트 로드 시점에 존재 필수.**
- `sb` — `sleeve.js:1055`가 가드 없이 `.textContent` 대입.
- `btnArmEdit`/`btnNeckEdit`/`btnSleeveEdit` — `handles.js`가 가드 없이 `.textContent` 대입.
- `modeAll`/`modeBody`/`modeSleeve` — `state.js`가 **`getElementById("mode"+k)`로 동적 조립**
  (정적 grep에 안 잡힘, 이름 규칙까지 고정).
- 나머지 입력·체크박스는 `?.value` / `?.checked`로 매 렌더 읽힌다.

**결론: 34개 ID 전부 유지.** 레이아웃 개편은 **요소 이동 + 상황별 숨김**으로만 한다.
새로 만드는 껍데기(stage 탭·tool rail 버튼·inspector 섹션)만 새 ID를 받는다.

### 구현 순서 (S1부터, 각 단계 검증·보고 후 다음 단계)

S0 DOM 조사·기준선 ✅ → **S1 CLAUDE.md 결정 기록** → S2 정적 CAD shell(기존 기능 전부
접근 가능 유지) → S3 `js/ui.js` 상태 함수·점진적 공개 → S4 기존 기능을 도구별 연결 →
S5 다트 inspector → S6 좁은 화면 → S7 실사용 검증 후 옛 UI 정리.

## ✅ CAD workspace S0~S7 완료 (2026-07) — 위 채택 섹션의 완료 기록

위 "컨텍스추얼 CAD workspace 채택"에서 확정한 방향이 **전부 구현됐다**. 아래는 과정
일지가 아니라 **확정된 결정·불변식·경계**다. 채택 섹션의 불변식은 그대로 유효하며,
이 섹션은 그것이 실제로 어떤 형태로 코드에 고정됐는지를 기록한다.

| 단계 | 내용 | 커밋 |
|---|---|---|
| S0 | DOM id → JS 의존성 전수조사와 기준선 (문서화만) | — |
| S1 | 방향·불변식 문서화 | `412acfb` Adopt contextual CAD workspace direction |
| S2 | 정적 CAD shell (기존 기능 전부 접근 가능 유지) | `8d75f99` Build static contextual CAD workspace shell |
| S3 | 중앙 UI 노출 상태 (`js/ui.js`) | `809bc77` Centralize contextual CAD workspace visibility |
| S4 | 기능을 올바른 표면에 배치 | `ba5604c` Place CAD utilities in their correct workspace surfaces |
| S5 | 읽기 전용 다트 inspector | `854359e` Expose a minimal read-only dart inspector snapshot |
| S6 | 좁은 화면 대응 | `29111e0` Adapt the CAD workspace for narrow screens |
| S7 | **증명된** dead CSS만 제거 | `e116845` Remove proven-dead legacy UI styles |

### 최종 레이아웃

- **상단**: `DOROBO` + 정적 `문화식 원형` / 수동 stage(`원형`·`디자인`) / `보기`·`파일`
  팝오버 / **곡선 편집 전용** undo·redo.
- **왼쪽 tool rail**: 실제 캔버스 상호작용 모드를 가진 **다트·곡선 둘만**.
- **중앙**: canvas toolbar(`전체`/`몸판`/`소매`, `화면 초기화`) + `svg#cv`.
  toolbar 는 **overlay 가 아니라 svg 의 형제**다.
- **오른쪽 inspector**: 현재 stage/tool 의 패널만.
- **하단**: 기존 `#sb` 상태바.
- **모바일 ≤615px**: 2행 header → 가로 tool bar → canvas → **일반 레이아웃 하단**
  inspector. **fixed/absolute overlay bottom sheet 를 만들지 않는다.**

### UI 상태 불변식 (위반 금지)

- `uiState` 는 **`stage` + `tool` 두 값이 전부**다. `stage ∈ {draft, design}`,
  `tool ∈ {null, dart, curves}`.
- `measurements` 는 상태가 아니라 **draft stage 에서 파생**된다(`activePanel()`).
- **`보기`·`파일`은 tool 이 아니라 상단 utility** 다 — tool rail 에 넣지 않는다.
- `재단`·`출력` stage 는 `disabled` + `aria-disabled="true"` + tooltip `준비 중`.
- **절개 / 길이 측정 / PDF / snap / grid on-off / fit / zoom 버튼 / 좌표 상태 표시는
  미구현이며 미노출**이다. 빈 패널·가짜 수치·동작하지 않는 버튼을 만들지 않는다.
- **자동 stage 진행·완료 체크·진척도 모델 없음.** stage 는 수동 전환만.
- `innerHTML` 재생성 없음 — `hidden`/`disabled`/`aria-*`/`textContent` 만 갱신한다.
- 기존 DOM **id 42개**와 **inline handler 37개** 계약 유지.
- 중앙 UI 함수는 `js/ui.js` 한 파일의 4개뿐: `setWorkspaceStage` / `setActiveTool` /
  `updateContextInspector` / `updateContextActions`.

### busy 안전성

- **dart/curve 의 "작업 중"을 별도 상태로 저장하지 않는다** — 매번 실제 DOM 에서
  파생한다(`btnDartMove` 텍스트, `dartSideRow` 의 display, 편집 버튼 텍스트).
  저장하면 엔진과 UI 두 곳에 진실이 생겨 반드시 어긋난다.
- busy 중에는 **stage 전환과 다른 tool 전환을 차단**하고 **현재 inspector 를 유지**한다.
- busy 중 **`보기`는 허용**(레이어 확인은 작업 중에도 필요), **`파일` 메뉴는 차단**.
- **UI 가 엔진 함수를 호출해 작업을 강제 종료하지 않는다** — 노출만 바꾼다.
  MutationObserver 는 `btnDartMove` 와 `dartMoveHint` **두 곳뿐**(document 전역 금지).

### 다트 inspector 경계 — `getDartMoveUiSnapshot()`

**11키**: `active`, `side`, `stepKey`, `viaSourceNotch`, `budgetRad`,
`sourceApertureBeforeRad`, `maxReachableRad`, `userAngleRad`, `openWidthCm`,
`valid`, `reasons`.

불변식:
- 매 호출 **새 plain object**, `reasons` 는 **복사본**.
- `shape` / `evalCtx` / `segments` / `pieces` 를 **노출하지 않는다**.
- getter 는 `bake`/`normalize`/`evaluateEndpoint` 를 **추가로 호출하지 않는다**
  (이미 계산된 `dartMoveState` 를 읽기만).
- UI 는 snapshot 을 **저장하지 않고 그 순간 읽는다**.
- gen-0(sourceNotch 없음)은 `새 다트 생성` 문구 하나만.
  `sourceNotch` 경로에서만 **소스 다트각**을 표시한다.
- 표시 항목: **이동 가능각** / **회전량(deg + cm)** / **전체 다트각**.

**★ `sourceApertureAfterRad` / `newNotchRad` 를 공개 snapshot 과 UI 에서 제외한 이유**:
이 둘은 source **identity 추적이 아니라 "열린 노치 중 최근접 각도"를 고르는 진단
휴리스틱**이다. 소스가 완전히 닫히면(잔여 mouth < `EPS_CLOSED_DART`) normalize 가
그 노치를 지우므로 휴리스틱이 **새 노치를 소스로 잘못 집어낸다**(실측: 진실 0° 인데
9.125° 로 보고). **엔진 결함이 아니라, 진단값을 제품 수치로 승격하지 않겠다는 결정**이다.
따라서 **잔여각·이동된 각은 표시하지 않는다.** 필요해지면 휴리스틱을 고치는 게 아니라
notch identity 를 실제로 추적하는 설계가 먼저다.

### 반응형 계약

- **breakpoint 는 실측 임계 `@media (max-width:615px)` 하나뿐**이다(데스크톱 header
  콘텐츠 최소폭 616px). **616px 부터 데스크톱**, 615px 부터 모바일.
- 모바일 **터치 타깃 최소 40px**(데스크톱 밀도는 불변 — media query 안에서만 확대).
- inspector 는 overlay 가 아니라 **일반 그리드 행**이고 **내부만 스크롤**한다
  (문서 이중 스크롤 없음).
- **320×568 에서 SVG 높이 190px** 확보.
- canvas toolbar 와 SVG 는 겹치지 않는다: `toolbar.bottom === svg.top`.
- **`svgPt` 및 `c2p`/`p2c_` 좌표 계약 유지**(전 viewport 왕복 오차 0 실측).

### 계속 유지되는 기존 계약

- **엔진 무변경**: dartMove 의 계산·split·bake·normalize·검증 로직을 UI 작업으로
  건드리지 않는다. **엔진 변경과 UI 변경을 같은 커밋에 섞지 않는다.**
- **shape/perf 골든 무변경** (S0~S7 전 구간 diff 0).
- **SVG 격자는 `render.js` 가 만드는 한 벌만** 쓴다(CSS 배경 격자 금지 — 두 벌이면
  줌·이동에서 어긋난다).
- **저장 기능 테스트는 격리 origin(`127.0.0.1:8420`) 또는 Node VM 에서만.**
  실제 사용자 origin 에서 `saveCurveData`/`autoSaveCurveData`/`import*` **실행 금지**.
- `armhole_data_2026-07-16.json` 은 **권위 백업**이며 **미추적 보존**. `AGENTS.md` 도
  미추적 보존. 둘 다 커밋하지 않는다.

### 알려진 한계 (기능이 없는 것이지 버그가 아니다)

- **undo/redo 는 곡선 핸들 편집 전용**이다(`pushUndoSnapshot` 이 편집모드에서만 호출).
  다트 이동은 undo 대상이 아니다.
- **`화면 초기화`는 고정 view reset 이고 fit 이 아니다** — 패턴에 맞춰 맞추지 않는다.
- **zoom 은 휠/핀치만** 있고 **버튼이 없다**.
- **snap 없음**, **grid on/off 없음**.
- **상태바의 좌표·줌·선택 상태 표시 미구현**(`#sb` 는 치수 요약만).
- **`재단`·`출력` stage 와 절개·길이 측정·PDF 미구현.**
- 위 항목들은 **자동 착수 금지** — 실제 사용에서 필요가 확인되고 별도 승인이 있을 때만.

### 다음 작업

- **UI 기능 추가가 아니라 실제 사용 검증.** 김이 직접 써 보고 **반복적으로 확인되는
  불편만** 후속 수정한다. 새 UI 부품을 선제적으로 추가하지 않는다.
- 이전 후보인 **"뒤어깨선 정리 + 앞/뒤 어깨 길이 맞춤"은 자동 착수 금지** —
  별도 조사·설계 승인 후 진행한다.

## 플로팅 컨텍스추얼 캔버스 툴바 채택 (2026-07, 사용자 확정) — 위 CAD workspace 결정 일부 대체

> ⚠️ **채택·구현 예정 단계다. 아직 구현되지 않았다.** 아래는 확정된 방향·계약이며,
> 코드는 이 문서 커밋 시점에 **전혀 변경되지 않았다**. 구현은 8번의 단계 커밋 계획대로
> 각 단계 별도 승인 후 진행한다.

**배경(실사용 피드백)**: 디자인 stage에서 다트이동/곡선편집을 하려면 도구(좌측 rail)와
그 조작(우측 inspector)이 화면 양 끝에 갈라져 있어 동선이 멀다. 실측 결과 다트이동
1회에 커서가 **2,637px**(좌우 폭 2회 왕복) 이동한다. 도구와 하부메뉴를 **캔버스 상단
바로 모아** 이 왕복을 없앤다(목표 ≈840px).

### 대체 관계 (위 "✅ CAD workspace S0~S7 완료 / 컨텍스추얼 CAD workspace 채택"의 일부)

**대체 (더 이상 따르지 않는다)**
- ~~왼쪽 contextual tool rail 을 둔다~~ → **좌측 tool rail 제거**. 도구는 캔버스 상단
  1행 바로 이동한다.
- ~~오른쪽 active-tool inspector 를 둔다~~ → **design stage 우측 inspector 제거**.
  선택 도구의 조작은 캔버스 상단 2행 context 카드로 이동한다.
- ~~`DEFAULT_TOOL.design = "curves"`(design 진입 시 도구 자동선택)~~ → **design 초기
  tool=null**(도구 미선택 상태에서 시작).

**계속 유지 (변함없음)**
- The best part is no part — 새 부품보다 기존 부품 재사용·이동을 먼저.
- **엔진 변경과 UI 변경을 같은 커밋에 섞지 않는다.**
- **구현되지 않은 기능을 작동하는 척하지 않는다.**
- stage 는 수동 전환만(자동 진행·완료 체크 없음).
- shape/perf 골든 무변경, 저장 검증은 격리 origin 만.
- 시각 체계(navy/cyan/orange 역할)와 **SVG 격자 한 벌 재사용** 규칙.
- `uiState = stage + tool` 두 값 모델, `innerHTML` 재생성 금지.

### 확정 계약 (채택, 구현 예정)

**1. 최종 목업 — iOS 곡률 플로팅 상단 바**
- **플로팅은 시각 표현만**이다. `position:absolute`/`fixed` overlay **금지**.
- **일반 레이아웃 행** + `border-radius`/`box-shadow` 로 떠 있는 느낌만 낸다
  (문서 흐름에 실제 높이를 차지한다).

**2. 레이아웃**
- 좌측 tool rail **제거**.
- design stage 우측 inspector **제거**. draft stage 치수 inspector 만 유지.
- 캔버스 상단 **1행**: `다트 이동 | 곡선 편집 ‖ 전체 | 몸판 | 소매` (세그먼트).
- **`화면 초기화`는 최상단 header 우측**으로 옮긴다(1행 바가 아니라 header).
- **선택 도구가 있을 때만 2행 context 카드**를 표시한다.
- **context 카드 미표시 시 빈 높이 0**(빈 자리·빈 바를 남기지 않는다).

**3. 상태**
- **design 초기 tool=null**.
- **dart 취소·적용 후 tool=null**.
- **curves 는 하위 편집(진동선/네크라인/소매산) 종료 후에도 tool=curves 유지.**
- **busy 중에는 현재 tool/context 를 유지**(작업 중 카드가 사라지지 않는다).
- `uiState` 는 **stage + tool 두 값만**. **새 엔진 상태를 만들지 않는다.**

**4. dart context 카드 (표시 항목)**
- 앞판/뒤판 · 이동 가능각 · 회전량(deg+cm) · 전체 다트각 · hint · **리셋 | 적용**.
- **적용은 가장 오른쪽.** (현재 index.html 은 `적용 | 리셋` 순서라 **교체 필요**.)
- **대상 / 현재 단계 / 소스 다트각은 중복 표시 금지** — 대상은 앞판/뒤판 활성으로,
  현재 단계는 hint 로 이미 드러난다. (현 우측 inspector 의 `getDartMoveUiSnapshot()`
  11키 중 side/stepKey/소스각 표시는 카드로 옮기면서 뺀다.)

**5. curves context 카드 (표시 항목)**
- 진동선 편집 · 네크라인 편집 · 소매산 편집 · 소매산 리셋 · 곡선핸들 리셋.

**6. 격자**
- **기존 `grid-m`(1cm) / `grid-M`(5cm) 두 단계를 그대로 재사용**한다
  (render.js:9~12 에 이미 존재 — 실측 확인). **render.js 변경 금지.**
  스케치의 2단계 방안지 느낌은 CSS 색만으로 충족된다.

**7. 보존 (위반 금지)**
- 기존 **DOM id 42개**, **inline handler 37개** 유지.
- **`innerHTML` 재생성 금지.** 요소는 **이동만**(DOM 복제 금지).
- `dartMove.js`/`render.js`/`layer.js`/`state.js`/`storage.js`/`handles.js`/`sleeve.js`
  **무변경**.
- **shape/perf 골든 무변경.** 저장 검증은 **격리 origin** 만.

**8. 구현 커밋 계획 (각 단계 별도 승인 후 착수)**
1. **구조·상태** — 마크업 이동(rail·inspector → 상단 바) + tool=null 계약 + 액션 순서
   교체. (js/ui.js 노출 로직 + index.html 재배치)
2. **iOS 곡률 스타일** — 카드 12~16px / 세그먼트 8~10px / 그림자, navy·cyan·orange.
3. **반응형** — 좁은 화면(≤615px) 2행 바 접힘, 가로 스크롤 금지.
4. **완료 문서** — 이 채택 섹션을 "구현 완료"로 갱신.
- **엔진·render·layer 무변경, 골든 무변경**을 매 단계 확인. UI·시각을 같은 단계에
  섞지 않는다(1=구조/상태, 2=시각 분리).

**남은 것(이 문서 이후)**: 구현 미착수. 다음 세션은 **8번 1단계(구조·상태)부터**
조사한 그대로 착수하되, 위 계약을 회귀 검증(동선 재측정 2,637px→목표, 계약 3·4의
tool=null / 액션 순서 / 빈 높이 0, id 42·handler 37 보존, 골든 무변경)으로 잠근다.

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
- **✅ (완료, 2026-07) 앞판 다중다트 회귀 고정** — 위 "헤드리스 회귀 테스트 하네스"
  섹션 참고. 결정론 60 + 다중다트 49 + 오래된 다트 2층 감사 83 PASS, 골든 3종
  (`front/multidart/oldest_retarget.json`). 리팩터 착수 전 안전망 완성.
- **✅ (완료, 2026-07) 형상 엔진 재설계 순서 ③ — C0~C7 전부 완료** — 위 "형상 엔진 재설계
  스펙" + 각 "C_ 완료" 섹션 참고. ①(`evaluateEndpoint`)·②(`findPhysicalSweepLimit`)·부호
  (`selectRotationSign`)·④(`resolveRequestedAngle`)가 배선됐고, preview·apply는
  `evaluation.shape`를 `getCurrentDartEvaluation()`로 공유하며(C6), apply 안전성은
  **`evaluation.valid` 단일 진실**로 축소됐다(C7, `7e0dafd`). legacy 부호 체인·③ 구간
  열거·apply 중복 게이트·C1 이중검증 전부 삭제. **4계층 evaluateMove 통합 단계 종료.**
- **✅ (완료, 2026-07) 파일 분리 타당성 감사 — 4파일 분리 기각, 한 파일 유지** — C0~C7
  이후 재설계 순서 ④(`dartMove.js`를 geometry/topology/engine/controller 4파일로 분리)의
  타당성을 읽기 전용으로 감사한 결과 **기각**한다.
  - **이유**: (1) 모듈 없는 전역 `<script>` 방식이라 파일 경계가 캡슐화를 **강제하지 못한다**
    — 나눠도 61개 함수가 전부 전역으로 남아 계층 규약은 지금 배너와 똑같이 관례일 뿐이다.
    (2) 전역/DOM 의존 감소 **0**(위치만 이동). (3) 테스트 단순화 **0**(loadEngine 로드 목록만
    +3). (4) 실제 외부 재사용 소비자 **0**(sleeve/render/draft 어디도 geometry 헬퍼 미사용).
    (5) 새 `<script>` 태그·캐시 버전·로드 순서 규약만 영구 증가.
  - 계획이 분리로 얻으려던 **engine 순수성**(dartMoveState/DOM 미접근)과 **UI·하네스 단일
    경로**는 순서 ②·③(C0~C7)에서 **이미 달성**됐다.
  - **결정: 현재 한 파일 + 배너 구역 유지.** 감사 중 드러난 배너 과장(GEOMETRY가 "순수
    기하"라 했으나 findSelfIntersections/findRotationCollisions가 세그먼트 타입 정책 참조)은
    주석만 정정(함수 이동 없음). `cleanForBake` 정책 사본 3→1 통합은 커밋 `17bf770`.
  - **재검토 조건**(셋 중 하나 발생 시에만): ES 모듈 전환 / geometry 헬퍼의 실제 외부
    소비자 발생 / bake 재설계(순서 ⑥) 완료. **bake/normalize 재설계는 자동 착수하지 않고
    실제 요구 + 별도 승인 후 진행한다.**
- **✅ (완료, 2026-07) 캔버스 중심 UI 개편** — 위 "캔버스 중심 UI 개편 완료" 섹션 참고.
  사이드바 제거·상단 레일·팝오버·floating context strip·블루프린트 시각 체계까지 완료
  (커밋 `97586c7`→`fbb1c69`). JS·엔진·골든 무변경.
- **(다음 단계) UI 기능 추가가 아니라 실제 사용 검증** — 엔진은 C0~C7 완료, UI는 캔버스
  중심 개편 완료 상태다. 다음은 김이 실제로 써 보고 **반복되는 불편만** 후속 수정한다.
  새 UI 부품·기능을 선제적으로 추가하지 않는다.
- **(그다음 기능 후보) 뒤어깨선 정리 + 앞/뒤 어깨 길이 맞춤** — 아래 "신규 기능 후보"
  항목과 동일 건. **자동 착수하지 않고 별도 조사·설계 승인 후 진행한다.**
- **✅ legacy 순수 삭제 완료** — `chooseSignedBaseAngle`·`budgetMaxAngle`·
  `applyTimeSafeAngle`·`findMaxSafeAngle`·`findApplicableIntervals`는 C5d에서, apply의
  self-intersection/budget 게이트·C1 블록은 C7에서 삭제. 위 "Dead code 감사"의
  `calc*CloseAngleByRotateHit` 3종은 이미 프로덕션에 없음(실측 확인).
