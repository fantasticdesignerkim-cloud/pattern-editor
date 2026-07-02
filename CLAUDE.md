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
- `dart-leg-new` = 새 다트 다리 (`disabled:true`)
- `dart-leg-old` = 잔여 다트 다리 (`disabled:true`)
- `isBakedBoundarySeg`: dart-leg, dart-leg-new, dart-leg-old, dart-bridge 전부 포함
- **dart-leg 계열은 어디서 오든(trailing 재사용 포함) 항상 `disabled:true`여야 함** — 아니면
  다음 세대 bake에서 일반 외곽선처럼 취급되어 조각 경계가 깨짐

### closeAngle / userAngle
- `closeAngle`은 계산값(`choosePhysicalCloseAngle`)이며 `baseAngle`(드래그 최대치)로만 사용, 절대 자동 적용 안 함
- `userAngle`은 항상 0에서 시작

### 파일 분리 / 클래스화
- `dartGeometry.js`/`dartState.js`/`dartInteraction.js` 분리: 엔진 안정화 전까지 보류
- `DartMoveEngine` 클래스화: 버그 해결 전까지 금지

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

- 3차 이상 다트이동에서 새로 발견되는 엣지케이스가 있는지 계속 스트레스 테스트
- 임시 디버그 로그 정리 시점 판단
- (장기) 파일 분리, class화는 여전히 보류 상태 — 엔진이 충분히 안정된 뒤 재논의
