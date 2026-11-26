# UI·워크스페이스 이력

> 사이드바 제거 → CAD workspace → 플로팅 캔버스 툴바 → 오버레이 팔레트까지의 UI 개편 전 과정(2026-07~08).

> 이 파일은 **완료된 작업의 이력**이다. 매 세션 로드되지 않고 필요할 때만 읽는다.
> 살아있는 계약은 [../../CLAUDE.md](../../CLAUDE.md), 색인은 [../INDEX.md](../INDEX.md).

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

> ✅ **구현 완료 (2026-07).** 이 섹션의 계약은 그대로 유효하며, 실제로 어떻게 코드에
> 고정됐는지는 아래 "✅ 플로팅 컨텍스추얼 캔버스 툴바 구현 완료" 섹션이 기록한다.

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
- ~~**플로팅은 시각 표현만**이다. `position:absolute`/`fixed` overlay **금지**.
  **일반 레이아웃 행** + `border-radius`/`box-shadow` 로 떠 있는 느낌만 낸다
  (문서 흐름에 실제 높이를 차지한다).~~
  → **실사용 검증으로 대체됨** — context 카드는 이제 canvas-wrap 기준 absolute 하단 팝업이다.
  아래 "캔버스 오버레이 다트 액션 팔레트" 섹션이 최종 계약이다(fixed·modal 은 여전히 금지).

**2. 레이아웃**
- 좌측 tool rail **제거**.
- design stage 우측 inspector **제거**. draft stage 치수 inspector 만 유지.
- 캔버스 상단 **1행**: `다트 이동 | 곡선 편집 ‖ 전체 | 몸판 | 소매` (세그먼트).
- **`화면 초기화`는 최상단 header 우측**으로 옮긴다(1행 바가 아니라 header).
- **선택 도구가 있을 때만 2행 context 카드**를 표시한다.
- **context 카드 미표시 시 빈 높이 0**(빈 자리·빈 바를 남기지 않는다).

**3. 상태**
- ~~**design 초기 tool=null**~~ → **폐기(S1)**: 다트·곡선은 이제 draft(원형) stage 도구다.
  ~~design stage 는 `STAGE_TOOLS` 에 키가 없어 항상 disabled(designProject/reference 구현
  전까지)~~ → **재정정(D3a~D3b)**: `STAGE_TOOLS.design=[]`, design 탭 활성은
  `designWorkflow.hasProject()` 게이트. 아래 "✅ 원형 완료 → 디자인 복사 (D1~D3b) 구현
  완료" 섹션 참고.
- **dart Apply 는 현재 다트만 커밋하고 세션과 tool=dart 를 유지한다**(다중다트 연속
  작업 보존 — `applyDartMove` 가 적용 후 `setBtn("취소")`/`setSideRowVisible(true)` 로
  세션을 열어 두고 "앞판/뒤판을 다시 선택"으로 다음 다트를 유도한다). Apply 직후
  이전 다트의 수치 행은 초기화되고 Apply 버튼은 다시 유효한 evaluation 이 생길 때까지
  disabled 다. **Cancel·Reset 만 세션을 종료하고 tool=null 로 돌아간다**(context 카드
  높이 0). 이 판정은 `busyTool()!=="dart"` 파생만으로 하며 dartMove.js 를 바꾸지 않는다.
- **curves 는 하위 편집(진동선/네크라인/소매산) 종료 후에도 tool=curves 유지.**
- **busy 중에는 현재 tool/context 를 유지**(작업 중 카드가 사라지지 않는다).
- `uiState` 는 **stage + tool 두 값만**. **새 엔진 상태를 만들지 않는다.**

**4. dart context 카드 (표시 항목)**
- 앞판/뒤판 · 이동 가능각 · 회전량(deg+cm) · 전체 다트각 · hint · **리셋 | 적용**.
- ~~**적용은 가장 오른쪽.**~~ (현재 index.html 은 `적용 | 리셋` 순서라 **교체 필요** → 교체 완료.
  이후 실사용 검증에서 "적용 최우측" 배치 계약은 **폐기**됐다 — 아래 "dart 액션 동선 교정"
  섹션이 최종 계약이다. DOM 의 리셋→적용 순서 자체는 유지된다.)
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

**남은 것(이 문서 이후)**: ~~구현 미착수~~ → **전 단계 구현 완료.** 아래 완료 섹션 참고.
## ✅ 플로팅 컨텍스추얼 캔버스 툴바 구현 완료 (2026-07) — 위 채택 섹션의 완료 기록

위 채택 섹션의 계약이 **전부 구현·검증됐다**. 과정 일지가 아니라 확정된 결정·불변식·
최종 계약만 남긴다.

| 커밋 | 내용 |
|---|---|
| `2394b35` | 채택 (0단계 문서 결정) |
| `7818e0a` | Apply 계약 교정 (문서 — Apply 는 커밋, Cancel·Reset 만 종료) |
| `5d2a52a` | Move design tools into contextual canvas bars (1단계 구조·상태) |
| `79b917d` | Apply iOS-style curvature to contextual canvas controls (2단계 시각) |
| `9cad52d` | Complete responsive contextual canvas bars (3단계 반응형) |

### 최종 구조

- **좌측 tool rail 제거**, **design 우측 inspector 제거**. draft 치수 inspector 만 유지
  (design 에서는 `.workspace:has(> .inspector[hidden])` 가 280px column 도 제거).
- 캔버스 상단 **1행**: `다트이동 · 곡선편집 ‖ 전체 · 몸판 · 소매`.
- **`화면 초기화`는 header 우측**.
- **도구 선택 시에만 2행 context 카드** — `.context-host:has(> [data-panel]:not([hidden]))`.
  tool=null 이면 **높이 0**(빈 자리 없음).

### 상태 계약 (구현 확정)

- ~~design 최초 진입 **tool=null** (`DEFAULT_TOOL.design=null`, 자동 curves 선택 폐지)~~
  → **폐기(S1)**: `STAGE_TOOLS={draft:["dart","curves"]}`, `DEFAULT_TOOL={draft:null}`.
  ~~design 은 미가용 stage 라 항상 disabled~~ → **재정정(D3a~D3b)**: `STAGE_TOOLS.design=[]`,
  design 탭 활성 = `designWorkflow.hasProject()`. 아래 "✅ 원형 완료 → 디자인 복사 (D1~D3b)
  구현 완료" 섹션 참고.
- **Apply 는 현재 다트만 커밋하고 tool=dart·세션을 유지**한다(다중다트 연속 작업).
  Apply 직후 이전 다트 수치 행 초기화·Apply disabled, 같은 세션에서 앞판/뒤판 재선택
  → 다음 다트 작업 가능(실측: 2번째 다트 절개→조각→드래그 정상).
- **Cancel·Reset 만 tool=null**(context 높이 0, aria-pressed 해제).
- curves 는 하위 편집 종료 후에도 **tool=curves 유지**.
- **`syncToolFromBusy()` 가 refresh 시작에서 호출되는 유일한 busy→tool 동기화 지점**이다.
  `updateContextActions`/`updateContextInspector` 는 uiState 를 **변경하지 않는다**(읽기만).
  이 순서를 어기면 Reset 후 tool 은 null 인데 도구 버튼 aria-pressed 만 옛 값으로 굳는
  순서 버그가 재발한다(실측으로 확인하고 분리한 구조).

### 시각 계약 (구현 확정)

- ~~iOS 곡률은 **radius/shadow 기반 일반 흐름** — absolute/fixed floating overlay 아님.
  카드 `margin 8px + radius 12px + shadow`~~ → **실사용 검증으로 대체됨** — 카드는 아래
  "캔버스 오버레이 다트 액션 팔레트" 계약(absolute 하단 팝업)을 따른다. 세그먼트는
  연회색 트랙(9px) 위 알약(7px) 그대로.
- **기존 색상 토큰만 재사용**(`color-mix` 파생 포함), 새 토큰 0.
- ~~dart 카드 순서: `앞판·뒤판 | 가능각 | 회전량 | 전체 다트각 | hint | 리셋 | 적용`.
  **적용이 최우측**. 데스크톱 dart 카드 높이 **47px**(세로 187px 스택에서 압축).~~
  → **실사용 검증으로 대체됨** — 아래 "dart 액션 동선 교정" 섹션이 최종 배치 계약이다.
- `setBtn`(JS) 이 다트 버튼에 덮는 inline 상태색(빨강/주황)은 계약대로 유지 —
  `[style*="background"]` 파생으로 그때만 글자·아이콘을 흰색으로 맞춘다.
- **`grid-m`/`grid-M` 기존 SVG 격자 재사용, render.js 무변경.**

### 반응형 계약 (구현 확정)

- **`@media (max-width:615px)` 하나뿐.** 616px 부터 데스크톱, 844×390 landscape 도
  데스크톱 유지.
- 모바일 context 카드는 **wrap**(가로 스크롤 없음), 터치 타깃 **40px**,
  **320×568 draft SVG 192px**(3행 grid 잔재로 150px 로 눌리던 원인 수정).
- **`tool-rail` selector·참조 0**(HTML/JS 참조 0 + 8개 UI 상태 런타임 match 0 증명 후
  규칙·주석까지 삭제).
- **좁은 데스크톱(616~698px) header 는 `clamp()` 유동 여백으로 압축** — 화면 초기화
  버튼의 header 이동으로 콘텐츠 최소폭이 699px 가 된 것을 흡수한다. clamp 상한이
  기존값이라 넓은 데스크톱(1280+) 시각은 **불변**(1440 실측: gap 16px·패딩 10px 그대로).
- **320px header 는 정직하게 actions 를 2줄로 wrap** 한다 — 텍스트를 숨기거나 글자를
  더 줄이지 않는다(전체 문자열 유지, brand 겹침 0).

### 유지된 안전 계약

- DOM **id 42개** / inline handler **37개** / MutationObserver 2개 /
  `getDartMoveUiSnapshot` 11키.
- **엔진·render 무변경**(1~3단계 전 구간 JS 변경은 `ui.js` 하나, 그 외 0).
- **shape/perf 골든 무변경.**
- 저장 검증은 **격리 origin**(`127.0.0.1:8420`)만, storage 0키 시종 유지.
- 미추적 `AGENTS.md`·`armhole_data_2026-07-16.json` 보존.

### 검증 결과

- **9개 viewport 전수**(1440·1280·616·615·430·390·360·320·844×390):
  가로 overflow **0** / 6영역(header·bar·카드·SVG·inspector·statusbar) 겹침 **0** /
  보이는 버튼 텍스트 잘림 **0** / DOROBO 전체 표시 / dart 카드에서 리셋·적용 접근 가능.
- SVG 좌표 계약 유지(`svgPt` 정확, `c2p`/`p2c_` 왕복 오차 0). 콘솔 오류 0.
- `runAll.js` 전체 통과.
## dart 액션 동선 교정 (2026-07, 실사용 검증) — 카드 배치 계약 대체

**배경**: 실사용에서 다트 회전 후 리셋·적용까지 동선이 너무 멀었다. 원인 실측(1440×900):
context 카드가 **전체 폭 1,420px**이라 hint(`flex:1`)+`margin-left:auto` 가 적용 버튼을
화면 우단(1394px)까지 밀어, 회전 종료점→적용이 **1,103px**. "적용 최우측" 계약이
전체 폭 카드에서는 "화면 우측 끝"이 되어버린 것.

### ~~최종~~ 배치 계약 (이전 "적용 최우측" 계약을 대체 → 이후 재차 대체됨)

> 이 섹션의 "상단 중앙·일반 흐름" 배치도 **실사용 검증으로 다시 대체됐다**(회전점이
> 캔버스 중하단이라 상단 카드 567px 가 부족). 아래 "캔버스 오버레이 다트 액션 팔레트"
> 섹션이 최종 계약이다. CSS order·DOM 순서 유지·auto 금지·상태 계약은 계승된다.

- ~~context 카드는 전체 폭이 아니라 **`width:fit-content` compact 카드**, **캔버스 상단
  중앙 정렬**(`align-self:center`). 일반 레이아웃 흐름 — absolute/fixed overlay 아님.~~
- 시각 순서: ~~**`앞판·뒤판 → 리셋·적용 → 가능각·회전량·전체 다트각`**~~ (액션 내부 순서도
  이후 적용→리셋으로 재조정), hint 는 카드 내부 **둘째 줄**(`order` + `flex-basis:100%`).
- **CSS `order` 로 시각 순서만** 바꾼다 — **실제 DOM 의 리셋→적용 순서는 유지**.
- **"적용 최우측"(카드/화면 우단 정렬) 계약 폐기.** 액션의 `margin-left:auto` 금지.
- tool=null 이면 context 높이 0, **Apply 후 다중다트 세션 유지** — 기존 상태 계약 불변.

### 실사용 근거 (실측)

- 교정 후 drag 카드 폭 **746px**, 회전끝→적용 **567px** (**−48.6%**).
- 567px 는 세로 거리(카드↔회전 종료점) **559px** 에 근접한 **현실적 하한** — 남은 7px 를
  맞추기 위한 overlay·커서 추적 UI 는 도입하지 않는다.

### 안전 계약 (교정 커밋 `3887068` 검증)

- CSS 중심 — JS·DOM·uiState 변경 **0** (index.html 은 캐시 버전 1줄).
- id 42 / handler 37, 엔진·render·골든 무변경.
- 9개 viewport overflow·겹침 0, **320×568 draft SVG 192px** 유지, runAll 전체 통과.
## 캔버스 오버레이 다트 액션 팔레트 (2026-07, 실사용 검증) — 카드 배치 최종 계약

**배경**: 상단 compact 카드(567px)도 부족했다 — 회전점이 캔버스 중하단(y 590~600)이라
상·하 비교 실측에서 **하단 중앙 팝업이 평균 동선 절반**(A 상단 524px vs B 하단 300px)로
확정. 위 "일반 흐름·overlay 금지" 계열 계약 3곳(채택 1·구현 완료 시각·동선 교정)을
이 섹션이 대체한다.

### 구조 (구현 확정)

- **primary bar 순서: `전체·몸판·소매 → 다트 도구 → 곡선 편집`** (모드가 왼쪽).
- **다트 idle 은 아이콘만 표시**(가시 텍스트 없음), aria-label/title = "다트 이동 시작".
- **active 의 실제 `btnDartMove.textContent="취소"` 는 busy 판정용으로 유지**(변경 금지).
  ~~화면 표시는 `aria-pressed="true"` 일 때만 CSS `::after` 가 **"종료"** 를 그린다.~~
  → **실사용 검증으로 대체됨** — 아래 "다트 도구 icon-only 표시" 섹션이 최종 계약이다
  ("종료" 텍스트는 중복 정보였다). aria-label/title = "다트 이동 종료"(ui.js
  `syncDartLabel` 문구 1곳)는 그대로 유효하다.
  ⚠️ `[style*="background"]` 는 busy 신호로 쓰지 말 것 — `setBtn` 이 idle 에도 주황
  inline 을 남겨 오탐한다(실측).

### 다트 도구 icon-only 표시 (2026-07, 실사용 검증) — 위 "종료" 표시 계약 대체

**근거**: "종료" 텍스트는 중복 정보였다 — 다트 아이콘 + 주황/빨강 상태색 + tooltip 이
이미 역할을 표현한다. The best part is no part. 구현 커밋 `efb9bc3`.

- **idle·active 모두 화면에는 다트 아이콘만** 표시한다. 가시 "다트이동 시작"·"종료"
  텍스트 없음(`font-size:0`, **`::after content:"종료"` 금지**).
- **버튼 폭은 두 상태 모두 48px 고정** — 상태 전환 시 버튼 폭·primary bar 위치 불변
  (9 viewport 실측 48→48).
- 상태색은 기존 `setBtn`(JS) inline 그대로: **idle 주황 / active 빨강 + 흰 아이콘**.
- 상태 문구는 **tooltip·aria-label/title 만**: idle = "다트 이동 시작" /
  active = "다트 이동 종료".
- 실제 `textContent="취소"` 는 busy 판정용으로 유지.
- `aria-pressed` 는 상태·스타일 신호(흰 아이콘 전환 등)로 유지하되 **가시 텍스트
  생성에는 쓰지 않는다**.
- 안전: CSS 중심(JS 변경 0), id 42 / handler 37 / Observer 2, 다중다트 계약 유지,
  9 viewport overflow·겹침 0, runAll 전체 통과, 골든 diff 0.

### 하단 팝업 (구현 확정)

- context 카드는 **canvas-wrap 기준 `position:absolute`**, `left:50%; bottom:16px;
  translateX(-50%)`, `width:fit-content` + `max-width:calc(100% - 16px)`.
- **모든 viewport 에서 같은 하단 중앙 위치** — 844×390 등 뷰포트별 예외·새 breakpoint 를
  만들지 않는다. **fixed·modal·drag·커서 추적 UI 없음.**
- host 는 `pointer-events:none`, 실제 카드(`[data-panel]`)만 `auto` — **카드 밖 캔버스
  이벤트는 SVG 로 그대로 통과**한다(전 뷰포트 elementFromPoint 실측).
- **카드 표시 전후 SVG rect·높이·좌표 변환(`svgPt`/`c2p`/`p2c_`) 불변** — 팝업이라
  캔버스를 밀지 않는다.

### 카드 순서 (구현 확정)

- `앞판·뒤판 → 적용 → 리셋 → 가능각·회전량·전체 다트각`, hint 는 둘째 줄.
- **CSS `order` 만 사용, 실제 DOM id·onclick 유지.** 적용은 주황(action-primary),
  리셋은 중립.

### 상태 (기존 계약 계승)

- tool=null·Cancel·Reset 이면 카드 `display:none`.
- **Apply 후 tool=dart·카드·다중다트 세션 유지.**
- `btnDartMove.textContent="취소"` 계약과 busy 판정 변경 금지.

### 실사용 근거 (실측)

- 최초 전체 폭 카드 front 회전끝→적용 **1,103px** → 상단 compact **567px** →
  **하단 팝업 front 238px / back 362px** (front 기준 최초 대비 **−78%**).
- 카드가 일반 흐름에서 빠져 **SVG 높이 82px 회복**(714→796).
- 하단 카드가 주로 소매 참고 요소를 일부 가리지만 **몸판·회전 핸들은 가리지 않으며**,
  동선 이득이 더 크다는 결정(상·하 비교 실측 후 사용자 확정).

### 안전 계약 (구현 커밋 `0427a64` 검증)

- 변경 JS 는 **ui.js 의 접근성 문구 1곳뿐**. dartMove.js·render.js·엔진 무변경.
- id 42 / handler 37 / Observer 2. 9 viewport overflow·겹침·텍스트 잘림 0.
- **320×568 draft SVG 192px**, runAll 전체 통과, 골든 diff 0.
## contextual tool 반복 클릭 토글 (2026-07, 실사용 검증)

**근거**: 같은 버튼으로 연 팝업은 같은 버튼으로 닫혀야 한다 — 별도 닫기 버튼을 추가하지
않는다(The best part is no part). 구현 커밋 `3d9fc47`.

- **contextual tool 은 idle 상태에서 같은 도구를 다시 선택하면 tool=null**(팝업 닫힘).
  curves: 첫 클릭 열기 → 두 번째 클릭 닫기 → 세 번째 클릭 다시 열기.
- **실제 진동선·네크라인·소매산 편집 중(busy)에는 같은 도구를 다시 눌러도 팝업·편집을
  강제 종료하지 않는다**(편집 함수 호출 없음). 하위 편집 종료 후에는 기존 계약대로
  tool=curves·팝업 유지 — 그 상태에서 곡선 도구를 다시 클릭하면 닫힌다.
- busy 중 다른 stage/tool 전환 잠금 계약 유지. dart 는 기존 inline `toggleDartMove` 가
  엔진 세션을 먼저 처리하며, **Apply 후 다중다트 세션 유지 계약 불변**.
- 구현은 **`setActiveTool` 한 지점**: `같은 tool && !busy → null, 그 외 → tool`.
  새 상태·Observer·편집 함수 호출 없음. `syncToolFromBusy` 는 여전히 refresh 시작의
  유일한 busy→tool 동기화 지점이고, `updateContextActions`/`updateContextInspector` 는
  uiState 를 변경하지 않는다.
- 안전: 변경 JS 는 ui.js 대입 1줄. 엔진·handles·dartMove·render 무변경,
  id 42 / handler 37 / Observer 2, 9 viewport 정상, runAll 전체 통과, 골든 diff 0.
## ✅ 소규모 UI 교정 3종 (2026-08) — 다트버튼 색 · 소매 글씨 · 이세 카드

사용자 계약대로 세 가지를 한 사이클로 처리(엔진 무변경, 시각/표시만).

**1. 다트이동 버튼 색 — idle 회색 · active 빨강 · 주황 완전 제거**
- `setBtn("다트이동 시작", "#e07800")` → `setBtn("다트이동 시작", "")` (inline background 제거).
  idle 은 inline bg 없음 → `.tool-dart::before` navy 아이콘 = 곡선편집과 동일한 회색.
- active 는 그대로 `setBtn("취소", "#cc3333")`(빨강) + `[style*="background"]::before` 흰 아이콘.
- 아이콘-only·폭 고정·aria/title("다트 이동 시작/종료") 계약 유지. 실측: idle bg none·
  active rgb(204,51,51)·주황(224,120,0) 0.

**2. 소매 글씨 가독성 — `[data-sleeve-root]` 스코프 CSS**
- `.txt-dark/.txt-dep/.sleeve-guide-label` 을 **소매 그룹 안에서만** 11px 로 키우고 명암↑ +
  **반투명 흰 외곽선**(`paint-order:stroke; stroke:rgba(255,255,255,.92); stroke-width:2.8px`)
  → 보조선 위에서도 읽힘. 몸판 라벨은 무변경(스코프 밖). font-size 는 px(뷰박스 없음)라
  줌과 무관하게 일정 → 지나치게 작아지지 않음.

**3. 이세 정보 카드 — 모달 아님, 소매 안에 떠 있는 카드**
- 기존 `.ease-info` 텍스트(줌 비례 `11*viewZ` 라 줌아웃 시 작아짐)를 **고정 px 카드**로 교체.
  흰 배경 rect + `var(--border)` 테두리 + `drop-shadow`, 행 정렬(**뒤 암홀 / 앞 암홀 /
  소매산 / 총 이세**, 이세 음수면 빨강). `finalCapHeight` 를 소매산 행에 노출.
- **소매 그룹(`g`)의 마지막 자식으로 append** → 도안선·핸들 위. `pointer-events:none` 로
  편집 불방해. 소매 그룹 안이라 **소매 이동 시 카드도 함께 이동**. 위치는 소매 몸통 안
  빈 영역(`c2p(sx_B+1.5, sy_base+2)`)이라 화면 안(오른쪽 밖 아님).

**fit 보정(카드·라벨 대응) — 중심은 outline, zoom 은 full content**
- 세로중심 정렬로 union 높이가 줄어 zoom 이 상한 1 에 걸리면 소매 치수 라벨(EL/SL 등)이
  outline 밖으로 나가 잘렸다. → `symmetricFitBBox(centerBB, fullBB)` 신설: **중심은 봉제선
  outline union(대칭·≤1px)**, **zoom 은 라벨·보조선 포함 `measureFullContentBBoxCm`**(격자·
  이세카드 제외)를 outline 중심에 대칭으로 감싸 계산. 실측(1440): outline 중심오차 0px,
  gap 10cm, full content 잘림 0(viewZ 0.884).
- 회귀: `draftLayoutCheck` 에 `symmetricFitBBox` 순수 테스트 추가(**22 PASS**). 골든 diff 0.

**변경 파일**: `js/dartMove.js`(setBtn idle) / `js/sleeve.js`(이세 카드) / `js/draftLayout.js`
(symmetricFitBBox·measureFullContentBBoxCm·fit) / `css/style.css`(소매 글씨·카드) /
`index.html`(캐시 `?v=2026080910~911`). **엔진(split/bake/normalize)·design 경로·shape/perf
골든 무변경.** 검증은 격리 origin, 저장 0.


---

> 아래는 2026-11-26에 이전한 옛 STATUS 기록이다. 당시 진행 표기와 원문 링크를 보존했다. 상대 링크의 기준은 원래 위치인 `docs/STATUS.md`다.

~~~~markdown
## 앱 버전 표시 (2026-11-12 · 미커밋)

상단 DOROBO 옆에 지금 불러온 앱 버전(현재 «v2026.11.13.3»)을 항상 보여 준다(원형·디자인 공통, 다른 컴퓨터와 판 비교용).
- **단일 원천 = `index.html` 의 `#appVersion` 한 줄**(글자와 `aria-label` 두 군데 숫자). 정적 번호이며 최신 판정·API·자동 새로고침은 없다.
- **배포할 때마다 이 번호를 올린다** — 형식 `v연.월.일.그날순번`. 스타일은 `css/style.css` `.brand-ver`.

~~~~

~~~~markdown
## 라이트 테마 UI 레이어 통합(apple-light-ui 핸드오프) (2026-11-13 김님 «순서대로 진행시켜» · 미커밋 · Codex 검토 대기 · v2026.11.13.1)

핸드오프(`49ae2e5` 위 13커밋 · 로컬 전용)를 **현재 HEAD `34789da` 에 수동 통합**(옛 파일 덮어쓰기·패치 일괄 적용 없음). 표시만 — 엔진·형상·저장 형식·`css/style.css` 무변경.

- **통합 파일**: 신규 `css/apple.css`(덮어쓰기 전용 · style.css 뒤) · `js/appleChrome.js`(확대 알약 · 폰 하단 시트 · 화면 모드 · 폰 원형 맞춤) ·
  `js/inspectorInsights.js`(이세 배지·계산 노트·원형 vs 디자인 — 읽기 전용) + `index.html` 추가분(링크·머리 테마 스크립트·아이콘·보기 라벨 `for=`·화면 모드·확대 알약·시트 그래버·칩·insights·비교·스크립트 2).
- **통합하지 않은 것(blockedBy)**: 빠른 도구 **접기 그래버·높이 상한 덮어쓰기** — 현재 막대의 압축 배치(`designLineQuickBar` `data-fit` · grid/`display:contents` · 소형 상태줄)와 충돌. 그 압축 배치가 같은 목적을 이미 맡는다.
- **현재 기능 보존(조정)**: 버전 표시(폰 = 아이콘 아래 9px · 숨김 없음 · ≤360px 은 단계 줄을 둘째 줄로) · 카라 초기화 버튼 없음 · «곡선으로»·고정점 안내 · 완료 녹색/미완료 남색(`#cv .stage-done` 재고정) ·
  편집 점 흰 원/회색 네모/핸들(종전 청록 `#16BCE4` 고정 — `--cyan` 재매핑과 분리) · `canvasPan`(확대 알약 안내 = 원형 «Space+드래그» · 디자인 «빈 곳 드래그» · 터치 «두 손가락») ·
  빠른 도구가 뜨면 확대 알약은 오른쪽 위(1024 에서 아래쪽 12px 겹침 실측 → 수정) · 시트 상태는 **사용자 조작 때만** 저장(종전: 화면을 열기만 해도 키 생성).
- **9장 정리(가역)**: ① apple.css 도면 색 규칙 정리 — 서로 덮던 중복 → 선택자당 하나(정리 전후 computed style 51 그룹 × 밝게/어둡게 **차이 0**) ·
  ③ 원색 표시점 GG/B0 → 다트 청록 · B4 → 치수 황토 · 종속/문화식 보조/소매 앞·뒤 가이드 채도 낮춤(값만) · ⑤ 디자인 단계에서도 «보기 → 화면 모드»(레이어 행은 숨김) ·
  ⑥ «선·곡선 그리기» 말줄임 해소 · 체크박스 행을 제목 띠로 칠하던 것 정정. **보류**: ② `DEBUG_COLORS` 처리(김님 결정) · ④ 라벨 배치·폰 맞춤 기하 · ⑦ 캔버스 어둡게 · ⑧ 엔진 쪽 원본 결함(콘솔 오류·소매산 보정 초기값).
- **이세 배지**: 참고 표시(출처 `designSleeveA.js` 목표 이세 5%·1cm 경고 · «원형 규칙 아님» 문구) — 완료 게이트 아님(버튼·체크포인트 미접근 검사).
- **저장**: UI 키 2개만(`dorobo.ui.theme` · `dorobo.ui.inspectorSheet`) · 곡선 키(`armhole_data*`) 미접근. 격리 origin 확인 = «0키 → 사용자 조작 뒤 그 UI 키만».
- **동일성(통합 직전 `34789da` ↔ 통합 후 · 같은 치수 83/64/38 · `resetView()` · 1024×768 과 390×844)**: 기본 원형 DXF 73,854자 sha `2374aae5b704e9b0` 동일 ·
  곡선 JSON(timestamp 줄 제외) `82c232d253a86890` 동일 · 디자인 동선(박시 A → 여밈 → 소매 → 카라 M) geometry sha `5e131be2e29ca364` · 완료본 hash 3개(2779faf5/e9f8a797/249537ab) 동일.
- **실측(격리 `127.0.0.1:8420` · 실제 마우스 + 폭 에뮬레이션)**: 1024×768 = 원형 → 몸판 완료 → 소매 → 카라 → 바깥선 클릭(흰 원 2 + 네모 2) → «곡선으로» → 핸들 드래그(외곽 19.646 → 19.976 · 부착 18.3474 불변) →
  완료(녹색) → 저장·열기(메모리 왕복) 동일 · 빈 곳 드래그 이동 · 확대 알약 ± · 디자인 단계 화면 모드 전환. 390×844 = 머리줄 한 줄(버전 9px · 단계 4칸 한 줄) · 시트 끌기(펼침 550px · 도면 재맞춤) · 탭 접기 ·
  빠른 도구(막대 ↔ 시트 ↔ 알약 겹침 0 · 점 가림 0) · «더보기» · «곡선으로» · 핸들 드래그 · 빈 곳 팬(선택 유지) · 완료 · 저장복원. 320×640 = 머리줄 두 줄(넘침·잘림 0). 844×390(가로) = 넘침 0.
- 검사: 신규 `appleUiCheck` 38(로드 순서·기능 보존·우선순위·저장 키·안내 · runAll 등록) · `collarPresetsCheck` 버전 핀 v2026.11.13.1.
- **한계**: 실제 터치 미검증(두 손가락 팬·핀치 · 시트 끌기는 마우스 포인터로만). 검증 브라우저 창이 가려져 있으면 rAF·ResizeObserver 가 멈춰 스크린샷으로 프레임을 돌려 가며 쟀다. 폰 디자인 단계 기본 배율은 종전처럼 작다(칼라 40px 폭 · 확대 필요).
  어둡게 모드에서 빠른 도구 막대는 밝은 카드 그대로. 616–1100px 중간 폭은 844 가로만 봤다.

~~~~

~~~~markdown
## 몸판 «완료» 표시 · 카라 본체 선 편집 재진입 (2026-11-12 김님 실사용 2건 · 미커밋)

김님: «카라 모양 수정은 아직 안 되는 것 같다 · 몸판 A 박시라인 적용 → 여밈 적용 → 몸판 모양 완료 하면 외곽선 색이 바뀌지 않는다». UI 전용 —
checkpoint·geometry·hash·gate·저장 형식 무변경.

- **① 몸판 완료색(원인)**: 몸판 녹색이 `designOutline`(합성 외곽) **유무**에만 묶여 있었다(`.design-outline-composed`) — 외곽 수정 없이 완료하면
  색이 안 바뀌고, 반대로 완료 전 합성 외곽은 녹색이었다. 소매·카라만 `designDoneMarks` 가 완료 판정으로 칠했다.
  **보완(`js/designDoneMarks.js`)**: `stateOf` 에 `bodice`(완료본 있음 + `bodice-changed` 아님 = done · `designResult.check` 같은 권위 · 재검사 없음).
  앞·뒤판 «지금 외곽»(합성 외곽이 있으면 그 선, 없으면 working 재단 외곽)을 완료일 때만 녹색 + «몸판 완료», 완료 뒤 달라지면 녹색 해제 +
  «몸판 변경됨 · 다시 완료». 합성 외곽은 완료가 아니면 남색(`.stage-undone` #1D4ED8). **원래 몸판 맥락에서만**(`designLineTool.isOriginalBodiceContext` ·
  update 때 한 번) — 소매 Ⓡ~Ⓩ 파생 몸판·분리 조각·외곽 미리보기·여밈에는 안 묻힌다.
- **② 카라 M 본체 편집(원인)**: 49ae2e5 는 «본체 직접 수정» **첫 진입**만 선택·편집으로 넣었다. 이미 직접 수정(manual) 상태에서 선 도구가 꺼지면
  («편집 종료» · 그리기 취소 · 파일 열기 뒤 `afterRestore` 가 도구를 끔) 패널은 «직접 수정 중 · anchor 편집»인데 칼라 선을 눌러도 무반응이고,
  다시 켤 버튼은 숨겨져 있었다. **보완(`js/ui.js`)**: manual 중에도 같은 버튼을 «본체 선 편집 켜기»로 남김(`reenterCollarBodyEdit` — 선택·편집 재진입 ·
  형상·관리선·잠금 무변경). 그리던 선이 있으면(보존 분기) 켜지 않고 «그리기 완료/취소 뒤 다시» 안내(첫 진입 포함).
- **실측(격리 `127.0.0.1:8420` · storage 0 → 0 · 실제 마우스)**: 박시 A + 여밈 1.2/1.2 + 완료 = 녹색 18선 + «몸판 완료» → 여밈 1.5 / 여밈 제거 /
  밑단 연장 22 = 해제·변경됨 → 다시 완료 = 녹색 · 파일 저장→열기(메모리 왕복) 완료본 = 녹색 / 변경 상태 = 변경됨 그대로 · 외곽 반영 = 남색·변경됨 →
  되돌리면 녹색 · 유효 밑단 반영 뒤 완료 = 합성 외곽 녹색 · 돌먼 Ⓡ(파생 몸판) = 몸판 표시 없음·소매만 녹색. 카라: M 초기화 → 적용 → 본체 적용 →
  직접 수정 → 바깥선 클릭(앵커 4) → 중간·칼라 끝 앵커 드래그 반영 · 양 끝 고정 안내 · 도구 끈 뒤 클릭 = 무반응(재현) → «본체 선 편집 켜기» → 선택·드래그 ·
  그리는 중 = 안내·draft 보존 · 카라 완료 뒤 편집 = «카라 변경됨» → 다시 완료 · 파일 열기 뒤 버튼으로 재진입 · 1024×768 에서도 선택·막대 가림 0.
- **알려진 한계(이번에 확장 안 함)**: 보조선(guide)·절개선만 그린 것은 몸판 완료본 서명에 없어 녹색 유지(권위 그대로). 기본 M 은 외곽 휨 0 = 직선 3구간이라
  곡선 핸들이 없다(직선 → 곡선 전환 미지원) · 밴드(스탠드) 직접 편집 · 카라 외곽 대체선 미지원 · 본체 양 끝점(뒤중심·부착 앞끝) 고정.
  선택 중 «카라 완료» 글자가 중간 앵커 바로 위에 놓인다(클릭은 통과). 실제 터치 미검증.
- 검사: `designDoneMarksCheck` 40(§5 신설) · `lineAutoSelectCheck` 318(+3) · 캐시 핀 ui·css·완료 표시 2026111201.

## 몸판 상태 문구 = 실제 차단 사유 (2026-11-11 김님 실사용 버그 · 미커밋 · Codex 검토 대기)

- **증상(김님)**: 박시 A 몸판 밑단 수정 후 여밈 적용 → «몸판 모양 완료» 비활성, 아래 문구 «몸판 변경됨 · 다시 완료 필요 · 세션 전용»뿐.
- **원인(확정)**: `ui.js updateBodiceCheckpointUI` 가 완료본이 있고 변경됐으면 `check()` 결과와 무관하게 일괄 문구로 덮었다 — 버튼(`!c.ok`)은 맞았지만
  왜 막혔는지가 안 보였다. 여밈은 원인이 아니다: 헤드리스 8변형(앞뒤 곡선 밑단 같은 높이·중심 중간 시작·허리 위·앞만·끝점 다름·미반영) 모두
  여밈 1.2/1.2 전후 `fails`·`ok` 동일(여밈은 `check` 사유에 없음). 실제 차단 = 앞·뒤 옆선 차(`side-seam-mismatch`)일 때만. «fails 없는데 비활성» 동기화 버그는 재현 안 됨
  (`onApplyPlacket` 실패 경로는 checkpoint UI 를 안 부르지만 여밈이 check 에 안 들어가 버튼 값이 바뀌지 않는다).
- **보완(표시만)**: 순수 `bodiceStatusView(c, hasLatest, changed, failText, ver)` — 버튼 활성·문구 같은 값(`c.ok`). 변경됨 + 막힘 = «몸판 변경됨(완료본과 다름) · 다시 완료 전 검사(N건): 사유 전부 ·
  지금 옆선 앞·뒤·뒤−앞 — 고친 뒤 «몸판 모양 완료»» · 변경됨 + 통과 = «검사 통과 — 다시 완료할 수 있습니다». 미완료 옆선 차단에도 숫자. 게이트·형상·완료본 무변경.
- **검사**: `bodiceStatusNoteCheck` 21(신설 · runAll 등록 · ui.js 실제 함수 추출) — 곡선 밑단 → 완료 → 앞만 수정(차단 + 숫자) → 맞춤(다시 완료 가능) → 여밈(사유 변화 없음) → 재완료 → 여밈 뒤 재수정.
  브라우저(격리 127.0.0.1 · storage 0 · 실제 마우스): 완료(hash c817f63f) → 앞 밑단 앵커 드래그 = 비활성 + «…앞 28.43 · 뒤 29.37 · 뒤−앞 +0.95cm…» · 되돌림 = 완료됨 ·
  여밈 1.2/1.2 = 활성 + «검사 통과 — 다시 완료» · 완료본 hash 유지 · 콘솔 0. 캐시 ui 2026111101(핀 갱신: sleeve*UI·sleeveR~Z·Annotation 등 ui.js 핀).

~~~~

~~~~markdown
## 하단 패널·화면 이동 실사용 회귀 보완 (2026-11-11 김님 리뷰 1차 범위 · 미커밋 · Codex 검토 대기)

- **접힌 패널 높이 = 캔버스 25% 예산**(`designLineQuickBar.applyFit`): full → lean(역할 선택·옆선 상세를 «더보기»로, 머리줄에 «역할 ○○») → dense(한 줄 안내 + [주 작업 | 더보기·닫기]) → row(낮은 가로 화면 한 줄, 안내 칸 ≥96px일 때만). 버튼 44px 유지 · max-height 로 감추지 않음 · «더보기»는 종전처럼 위로 + 내부 스크롤. 회전 시 다음 프레임 재맞춤.
  실측(선택한 외곽 밑단, 접힘): 1024×768 22.8% · 390×844 22.4% · 320×640 23.3%(종전 55%) · 844×390 23.5% · 640×320 21.3%. 그리기 패널 320×640 23.3%.
- **빈 곳 드래그 = 화면 이동**(`js/canvasPan.js` 신설): 선·핸들·조각 드래그·그리기 점이 잡지 않은 누름만. 마우스 4px·터치 8px 미만 = 클릭(종전 선택 해제·거부 안내), 이상 = 팬(선택·작성 중 선 보존). Space = 즉시 팬(모든 stage). 두 손가락 = 핀치 + 중점 이동 팬(같은 뷰 변환 · init.js 터치 핀치 대체). 두 번째 손가락이 닿으면 한 손가락 편집 드래그·방금 점·조각 배치 드래그를 되돌린다(형상 좌표 불변).
- **Space**: blur·탭 숨김에서 해제(init.js·designLayout) · 입력칸/키보드 포커스 컨트롤/한글 조합 중 Space 는 가로채지 않음.
- **드래그 중 패널**: 행·자리·포커스 고정, 글자만 갱신 — 놓아야 확정되는 판정(반영·분리·외곽 대체·몸판 완료 검사)은 «편집 중 · 손을 떼면 다시 검사합니다». 사유 없는 막힘은 «0건» 대신 검사 결과 문구(게이트 완화 없음).
- 검사: `canvasPanCheck`(신설 29) · `lineAutoSelectCheck` §18(+8) · `lineQuickBarCheck` §10(+9 · 68). 실기기 터치 미검증(Pointer Events 합성 재현만).

## 패턴선 편집 패널 하단 고정 (2026-11-11 김님 «애플같이 아래에 고정» · 미커밋 · Codex 검토 대기)

참고: Apple HIG Sheets·Toolbars·Menus(구조·크기만 참고 — iOS 네이티브 UI 아님). 범위 = `js/designLineQuickBar.js` 배치 로직 · `css/style.css` 막대 블록 ·
`index.html` 주석·캐시 · `js/designLineTool.js` 1줄(Space 팬). 엔진·완료 게이트·선/역할 명령·저장 형식·프로젝트 파일 무변경. **아래 두 절의 «자리» 규칙(선 근처 후보 · `holdPlace` 붙박이 · 그리기 dock)은 이것으로 대체됨.**

- **자리 = CSS 만**: 선택 패널·그리기 패널이 같은 고정 자리(동시에 하나). 데스크톱 = 사이드바를 뺀 캔버스(canvas-wrap) 하단 가운데 카드(폭 ≤420 · bottom 12) ·
  ≤615px = 캔버스 하단 시트(좌우 꽉 · 위 모서리만 둥글게 · safe-area 하단 여백 — `viewport-fit=cover` 가 없어 지금 env 값은 0). JS 는 좌표를 쓰지 않는다.
  `place`·`keepPlace`·`holdPlace`·`dock`·`selKeep`·`dockIdx` 삭제 → 순수 함수는 `coverCount`(분리 결과를 덮는지 → 소형 상태줄 판정) 하나.
- 높이: 기본 상한 = 캔버스 55%(최소 168 — 머리줄·역할·주 작업 버튼은 늘 보임) · «더보기» = 같은 아래 기준점에서 위로 max(200,62%) · 넘치면 패널 안 스크롤(머리줄 sticky).
- 드래그·팬·핀치 중 숨기지 않고 내용 고정 → 손 떼면 한 번 갱신. 화면 밖으로 팬해도 선택 중이면 패널 유지. 패널 위 pointer·wheel 은 캔버스로 안 감(기존).
- 실측(실제 마우스 · 격리 127.0.0.1 · storage 0 전후 · 콘솔 0): 1024 = x162 w420 bottom12(앵커 드래그 3회·휠 줌·더보기 h363·역할 변경·그리기 완료/취소·다른 선·닫기·탭/스테이지 전환 모두 같은 x/bottom) ·
  390 = 시트 bottom0 h238(더보기 292 내부 스크롤) · 320×640 = 238 → 상한 후 177 · 844×390 가로 = 가운데 bottom12 h178 · 버튼 44 · 가로 스크롤 없음.
- **Space+드래그 팬 선택 유지(Codex 후속 · 최소 보완)**: 원인 = `init.js` 팬과 `designLineTool` 이 같은 `svg` pointerdown(같은 요소라 stopPropagation 무효) →
  선택 해제(그리기면 점 추가). `designLineTool` pointerdown 첫머리에 `spaceDown` 이면 무시 한 줄(형상·저장·게이트 무변경). 실측: 그리기 중 팬 = 점 안 찍힘 ·
  선택 중 팬 = 선택·역할·«더보기» 유지. (Space 는 합성 keydown + 실제 마우스 드래그.)
- **반영 성공 실측**: 앞판 옆선 밑 → 앞중심 밑 스냅 곡선 밑단 → 외곽 → «몸판 외곽으로 반영» 성공(녹색 합성 외곽) · 패널 190 → 160 같은 x/bottom ·
  «몸판 완료 막힘 1건»(더보기 = «옆허리 다트 c 허리 부착 불일치») · 패널 완료 버튼 숨김 = 오른쪽 «몸판 모양 완료» disabled 와 같은 게이트. 완료 가능 상태는 이 선으로는 재현 못 함.
- **한계**: 실제 터치(핀치·두 손가락 팬은 pointerdown 이 선 도구로도 감)·iOS Safari 실기기·브라우저 확대(⌘+) 미검증 · 좁은 화면은 캔버스 자체가 작아(320 = 322px) 접힌 시트도 55% 를 쓴다.
- 검사: `lineQuickBarCheck` 86 → 59(옛 배치 순수 검사 제거 · 하단 고정 계약 §2·§9 · Space 팬 2h 신설) · 캐시: css 2026111103 · 막대 2026111104 · designLineTool 2026111101
  (핀: `lineQuickBarCheck` · `sleeveAUICheck` · `sleeveAnnotationCheck` · `sleeveRCheck` · `sleeveSCheck` · `sleeveVCheck`).

## 선 근처 팝업·그리기 막대 iOS 메뉴형 정리 (2026-11-11 김님 «애플 아이폰 UI 참고» · 미커밋 · Codex 검토 대기)

참고: Apple HIG Popovers·Menus·Accessibility(공식 .md). 범위 = `css/style.css` 막대 블록 · `index.html` 막대 마크업 2곳(«더보기» 버튼 · 차단 사유 전문 칸) ·
`js/designLineQuickBar.js` 표시 로직. 엔진·geometry·저장 형식·선/역할 명령·그리기 dock 규칙·`holdPlace` 규칙 무변경.

- **원인(390 실측)**: 외곽 선택 직후 막대 = 머리 44 · 역할 44 · «몸판 외곽으로 반영» 84 · «외곽 대체 미리보기» 69 · 옆선+완료 차단 사유+«몸판 모양 완료» 103
  = **371px**(캔버스 471px) — 다음 단계 행이 동시에 2~3개, 긴 사유가 여러 줄로 다 펼쳐져 있었다.
- **주 작업 1개**: 보이는 다음 단계 행 중 첫 행(반영 > 파트 분리 > 외곽 대체)만 기본 표시(`data-tier="main"` · 시스템 파랑 채움 1개).
  나머지 행과(주 작업이 따로 있을 때의) «몸판 모양 완료»는 머리줄 **«더보기/접기»**(`#lineQuickMore` · aria-expanded)에서만 — 같은 버튼·같은 명령(삭제·가짜 비활성 없음).
  안내 글은 기본 한 줄(말줄임) · 완료 차단 사유는 «몸판 완료 막힘 N건» 한 줄 + 전문은 펼침 칸(`#lineQuickBodiceFailsDetail`). 펼침은 그 선 동안만(다른 선·선택 해제면 접힘).
  펼친 동안은 자리를 옮기지 않는다(clamp 만 · 가장자리 이동·좌우 flip 없음).
- **시각**: 막대 안 CSS 토큰(`--lqb-*`) · 흰 표면(backdrop-filter 지원 시 .94 + blur, 아니면/투명도 줄이기·대비 높이기면 불투명) · 14px 모서리 · 얇은 경계 · 은은한 그림자 ·
  역할 = 세그먼트(선택 = 흰 칸 + ✓ — 색에만 기대지 않음) · 보조 작업 = 옅은 파랑 · 얇은 구분선 · 44px · 눌림/비활성/포커스(3px 파랑 링). 주황 다중 채움 제거. 위치 애니메이션 없음.
- **실측(실제 마우스 · 격리 127.0.0.1 · storage 0 전후)**: 390 외곽 선택 371 → **239px**(반영 후 160) · 펼침 207/379(데스크톱) · 밑단 앵커 3회 드래그 자리 (8,8) 그대로(상태줄 239↔160 변화) ·
  320 막대 264×160 · 버튼 44 · 가로 스크롤 없음 · 그리기 취소 → 기존 선·역할 보존 · 키보드 Enter 펼침/접기 포커스 유지 · 원형↔디자인 이동 숨김/복원 · 콘솔 오류 0.
  **실제 터치 미검증**(마우스만). 소매/카라 «완료» 녹색 표시는 코드 무변경 + `designDoneMarksCheck` 32 통과로만 확인(브라우저 완료 동선 재현 안 함).
- 캐시: css 2026111101 · 막대 2026111103 (핀: `lineQuickBarCheck` 3h · `sleeveAUICheck` 7 · `sleeveAnnotationCheck` · `sleeveRCheck` 11 · `sleeveSCheck` 9 · `sleeveVCheck` 12).

## 선택 팝업 자리 고정 재설계 · 소매/카라 «완료» 표시 (2026-11-10 김님 요청 · 미커밋 · Codex 검토 대기)

역할 정정(김님): 디자인·치수·패턴 수정/저장·이후 시접 완성은 김님이 직접 한다. AI = CAD 도구·큰 흐름 보조.
공식·제도 엔진·카라 원리/치수·저장 형식·shape 골든 무변경. 앞여밈 + 카라 M 연결 조사(아래 작업표 §7)는 문서만 · 이번에 구현 안 함.

- **선택 팝업 자리(`designLineQuickBar.holdPlace`)** — 원인(390 실측): 앵커를 막대 밑으로 끌면 `keepPlace`=null → `place()` 가
  **지금 형상 기준으로 새 자리**를 고르고, 반영·사유 행이 다시 생겨 막대가 커지면 또 새 자리, 되돌려도 새 자리가 기준이라
  처음 자리로 안 돌아왔다(88,8 → 196,8 → 196,92). 전체/소형 형태도 매 sync 재채점.
  규칙: 같은 선 동안 선 주변 재채점 없음 · 처음 자리(home)를 크기만 clamp · **잡는 점(앵커·핸들 점)**을 가릴 때만 캔버스 가장자리
  고정 자리(6곳 · 잡는 점 최소 → 선 점 최소 · 엄격히 나아질 때만 이동 = 왕복 flip 없음)로 옮겨 그 선 동안 머묾. 형태는 결과·펼침이
  바뀔 때만 한 번 정함(자리는 유지). 다시 고르는 경우 = 다른 선 · 닫기 후 재열기 · 창 크기 변화 · 헤더 «화면 초기화». 팬·줌·캔버스
  높이(상태줄)는 다시 고르지 않음. 드래그 중 숨김 → 손 떼면 같은 자리. 그리기 dock 무변경.
  실측(실제 마우스): 390 밑단 곡선 핸들·앵커 3회 드래그 → (8,8) 그대로 · 320 2회 → (126,8) 그대로 · 버튼 44px · 가로 스크롤 없음.
  **한계**: 390 에서 외곽 선택 직후 반영·옆선 행까지 보이면 막대 371px(캔버스 471px) → 어디도 잡는 점을 다 비울 수 없어 가장 덜 가리는
  가장자리에 둔다(행이 줄면 한 번 더 나은 가장자리로 이동 가능).
- **«완료» 표시(`js/designDoneMarks.js` 신설 · UI 전용)** — 판정 = `updateDesignResultUI` 가 이미 돌리는 `designResult.check` 결과를 캐시
  (render 는 class·글자만 붙임 · 재검사 없음 · 완료본 객체가 바뀌면 캐시 무효). 유효 완료본 = 현재 형상일 때만 소매 working 외곽 ·
  커프스 재단 외곽 · 카라 완료본 종류의 조각 외곽(2피스 = 밴드·위 칼라 …)을 몸판 수정 외곽과 같은 녹색(#0E9F6E · 2.8) + 조각 위
  «소매 완료»/«카라 완료». 다시 완료가 필요하면 녹색 없이 «소매 변경됨 · 다시 완료»(소매가 변경이면 카라도 완료로 안 보임).
  «외곽 반영»된 소매 선은 반영본 서명과 같을 때만 녹색(움직이면 남색). 선택 중 선은 청록 우선. 접는선·꺾임선·덧단 완성선·몸판(파생 포함) 제외.
  일체형 소매(Ⓧ·Ⓨ·Ⓩ · 별도 소매 조각 없음)는 표시 없음. 몸판 «완료» 글자는 이번에 안 넣음(파생 몸판 거짓 표시 위험).
- **탭 이동 선택 해제(`setDesignSubtab`)** — 소매 선을 선택한 채 소매 완료 → 카라 탭이면 청록 덧그림·앵커·빠른 막대가 남아 미완료처럼
  보였다(재현). 다른 탭 조각의 선택만 해제(선·역할·형상 무변경).
- 검사: `lineQuickBarCheck` 86 · `designDoneMarksCheck` 32(신설, runAll 등록) · 캐시 핀 정리(ui 2026111005 · render 2026111005 ·
  css 2026111002 · 막대 2026111003 · 완료 표시 2026111003). 브라우저(격리 127.0.0.1 · storage 0): 적용만 = 표시 없음 → 완료 직후 녹색+글자 ·
  탭 3개 이동 유지 · 카라/소매 수정 → 변경됨 · 되돌림 → 완료 · 저장 → 새로고침 → 복원 후 동일 · working hash 표시 전후 동일 · 콘솔 0.

~~~~
