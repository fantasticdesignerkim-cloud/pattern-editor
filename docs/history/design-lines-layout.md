# Design 배치·패턴선 도구 이력

> piece 독립 배치와 패턴선 도구 1~6차·역할·절개선·파트 분리·외곽 대체선(2026-08).

> 이 파일은 **완료된 작업의 이력**이다. 매 세션 로드되지 않고 필요할 때만 읽는다.
> 살아있는 계약은 [../../CLAUDE.md](../../CLAUDE.md), 색인은 [../INDEX.md](../INDEX.md).

## ✅ Design piece layout — 형상 불변 작업 화면 배치 (2026-08, `82b3e43`)

**배경(사용자 구분)**: 회색 reference↔남색 working 겹침은 **의도된 비교 겹침**(유지),
몸판↔소매 겹침은 **배치 문제**(수정). 엉덩이 길이 연장으로 몸판이 아래로 늘어 소매와
겹칠 수 있어, **형상은 안 움직이고 작업 화면 배치만** 이동하게 만들었다.

**핵심 분리 — 배치(offset) ≠ 카메라(화면 중심)** (2026-08 사용자 재확정: union 중심)
- **소매 offset**: **화면 폭과 무관하게 항상 몸판 오른쪽 끝 + 10cm**(도안 cm). 넓/좁 분기
  없음(모바일도 오른쪽). ~~`dy=0`~~ → **2026-08 원형과 동일 기준으로 통일**:
  `autoSleeveOffset(geometry)` = `dx=(bodyMaxX+10)−sleeveMinX, dy=bodyCenterY−sleeveCenterY`
  (몸판·소매 bbox 세로 중심 일치 — 대각선 아래가 아니라 옆으로 나란히). reference·working 에
  같은 dx/dy 적용. manual(사용자가 소매 드래그)이면 `refreshAutoSleeve`/`afterBodyLength` 가
  early-return 해 세로 위치 강제 안 함. `enterDesign`·`배치 초기화`·`소매 오른쪽` 은 auto 로
  재정렬. **검증(desktop·615·390): 세로중심 오차 0, gap 10cm, union 중심 ≤1px, manual 유지,
  reference=working transform 동일, 저장 0.**
- **진입/리사이즈/초기화 = union 중심 fit(`fitUnion`)**: 몸판+소매를 **한 묶음**으로 보고,
  **union bbox 중심**(몸판 중심 아님)을 viewport 중심에 두고 union 전체가 24px 여백 안에
  담기도록 zoom 자동 계산(`fitZ=min((W/2−24)/(halfW·SC),(H/2−24)/(halfH·SC),1)`, 하한 0.1).
  소매가 오른쪽에 있어 **몸판은 화면 중앙에서 왼쪽으로 치우친다**(정상). geometry·layout
  좌표 불변, 카메라만. 실행: **design 최초 진입 · `배치 초기화` · `소매 오른쪽` · `화면
  초기화`(design) · 엉덩이 길이 적용 후(auto) · 창 리사이즈**.
- **`몸판 중앙` 버튼만 예외**: **현재 zoom 유지**하고 카메라만 **몸판 bbox 중심**으로
  (`centerCameraOnBody`). union 이 아니라 몸판을 화면 중앙에 두는 "몸판 집중" 동작이다.
- 사용자가 조각을 드래그하면 이후 리사이즈에서 **자동 재중앙 안 함**(`_userArranged`).

> ⚠️ 이전 기록(위쪽 fit 섹션들)의 "몸판 중심을 viewport 중심에 고정(union 중심 아님)",
>   "소매 넓으면 오른쪽+5cm/좁으면 아래", `fitBodyAnchored` 는 **이 union-중심·항상-오른쪽
>   10cm 결정으로 대체**됐다(코드에서 `fitBodyAnchored`→`fitUnion`, narrow 분기 제거).
- **수동 줌 하한도 stage 별로 다르다(init.js `_minZoom`)**: **design 0.1 / draft 0.2**.
  auto-fit 이 viewZ<0.2 로 내려가도 첫 휠·핀치가 0.2 로 튀지 않고(확대는 연속 증가,
  축소는 0.1 까지) 조작된다. **draft 줌 계약(0.2)은 무변경**, 최대 10 유지.
- **리사이즈/리플로우 recompute(`54b4c71`, 기준영역 버그 수정)**: fit·중앙은 **가시 캔버스
  = `#cv` 요소**(오른쪽 inspector 제외, 데스크톱은 grid column 으로 분리·모바일은
  inspector 가 아래로 내려가 svg 가 전폭) 기준이다. 이 계산이 **진입/버튼에서만** 돌아
  창 크기·데스크톱↔모바일 전환 뒤 몸판이 가시 중앙에서 벗어나던 버그가 있었다. →
  `window resize` 에 rAF 디바운스로 **design 일 때 카메라만 다시 fit**(형상·layout 좌표
  불변). **사용자가 조각을 드래그하면 `_userArranged=true` → 리사이즈 자동 재중앙 금지**
  (버튼/진입이 false 로 해제). **draft 는 무영향**(`inDesign()` 게이트). 실측: 1600→1280→
  400(모바일)→500 리사이즈에서 몸판 중심오차 0px·둘 다 24px 내·겹침 0, 드래그 뒤 리사이즈
  는 배치 유지(재중앙 안 함), draft 카메라 불변.

**데이터(세션 전용, cm)**: `project.working.layout = { body:{dx,dy}, sleeve:{dx,dy},
sleevePlacement:"auto"|"manual" }`. 소매를 사용자가 드래그하면 `"manual"` → 이후 자동
이동 안 함. 엉덩이 길이 적용 시 `sleevePlacement==="auto"` 면 몸판 높이 변화에 맞춰
소매 재배치, `"manual"` 이면 유지. reload 시 working 과 함께 소멸 → 기본 배치 복귀.

**전역 z-order(필수)**: `grid → reference root(body,sleeve) → working root(body,sleeve)
→ hit layer(body,sleeve)`. **모든 reference 가 모든 working 보다 아래**여야 조각이 다시
겹쳐도 회색이 남색을 안 가린다(bodyG 안에 ref+work 를 넣는 구조는 금지 — 소매 ref 가
몸판 work 위에 올라올 수 있다). render.js 는 geometry 를 piece 서브셋으로 나눠 각 root 에
담고, piece 별 **SVG `transform="translate(dx·SC·viewZ, dy·SC·viewZ)"`** 만 건다(좌표 불변).
reference·working 에 **같은 offset** 을 적용해 함께 이동한다.

**드래그**: 투명 hit rect(`.design-layout-hit[data-layout-piece]`, `pointer-events:all`)를
최상단 hit layer 에 두고, reference/working 은 `pointer-events:none` 유지. pointer delta
(SVG px)를 `SC·viewZ` 로 나눠 cm 로 환산해 `working.layout[piece]` 만 갱신 후 render.
**Space+drag 는 기존 pan 우선**(designLayout 이 자체 spaceHeld 추적), pointer capture 는
svg 에(재렌더로 rect 가 바뀌어도 유지). geometry·reference 불변, 저장 쓰기 0.

**버튼(design inspector)**: `몸판 중앙`(현재 zoom 유지·카메라만·**몸판 중심**) / `소매 오른쪽`
(body 기준 오른쪽+10cm auto 복귀 후 **union fit**) / `배치 초기화`(body {0,0} → 소매 재배치
→ 기준 SC → **union fit**, 결정론적). `화면 초기화`(resetView)는 design 에서 **기준 SC +
union fit**(배치 offset 유지) — init.js resetView 가 `isDesignStageActive()` 로 분기.
`엉덩이 길이 적용`(ui.js `afterBodyLength`): auto 면 소매 재배치+fit, manual 이면 카메라·
offset 유지(자동 이동/재fit 안 함).

**파일(11)**: `js/designLayout.js`(신규: bbox·auto 배치·카메라·드래그, 순수 함수는
DOM 미접근) / `js/designProject.js`(working.layout 기본값) / `js/render.js`(design 분기
z-order·piece transform·hit rect) / `js/ui.js`(enterDesign 훅·배치 버튼·엉덩이 적용 후
auto 소매 갱신) / `js/init.js`(resetView design 분기) / `index.html`(배치 UI·스크립트·캐시
render·designLayout·init·ui `?v=2026080503`) / `css/style.css`(hit rect) / 하네스 4개.
(fit 보완 후속 커밋 `e9cdf71`: designLayout `fitBodyAnchored`/`afterBodyLength`,
render hit-rect pad 6→3px, ui `afterBodyLength` 호출.)

**계약(유지)**: sourceBlock·baseSource·referenceGeometry·working.geometry(좌표) 불변 /
reference·working 동일 offset / 전역 z-order / draft 화면 무변경 / reload 시 layout 소멸 /
엉덩이 길이 계산 불변 / 저장·autosave 0 / 줌·팬과 배치 독립.

**검증**: 하네스 — designLayoutCheck **12**(bbox·auto wide/narrow·ensureLayout),
designProjectCheck **42**(layout 기본값·mutable·불변), designRenderBranchCheck **20**
(z-order 4-root·piece 서브셋·재생성), runAll 전체 통과·golden diff 0. 실브라우저 —
design 진입 시 z-order(ref→work→hit)·ref·work 동일 transform·소매 auto 오른쪽 10cm(dx 51.97cm)·
hit rect 2개, 드래그(body +8cm, 소매 drag→manual)·버튼(몸판중앙=몸판중심/소매오른쪽/배치초기화)
전부 형상 불변, 엉덩이 L=10 후 auto 소매 갱신, draft 왕복 시 dirty·원형 shape 불변,
design 재진입 배치 유지, reload 시 project·layout 소멸(design 탭 비활성), storage 0·콘솔 0.
**9 viewport 각각 design 진입 fit**(1440·1280·616·615·430·390·360·320·844×390): **몸판·소매
geometry bbox 모두 24px 여백 안에 완전히 담김**(9/9), 몸판 bbox 중심 vs viewport 중심 오차
≤0.25px(≤1px), overlap 0, ref·work transform 동일, fit 중 geometry·layout 불변, 배치
초기화 결정론(2회 동일), drag 후 자동 fit 없음, 엉덩이 길이 auto→재배치+fit·manual→카메라·
offset 유지. zoom 범위 **0.139~0.405**(가장 작은 320×568=0.139, 844×390=0.142 — 모두 하한
0.1 위라 소매까지 담김). no-jump 실측: auto-fit 0.142 → 확대 연속(×1.12)·축소 0.1 하한,
draft 축소는 0.2 하한 유지. DOM id **49→52**, inline handler 37 유지.
(참고: hit rect 는 bbox+3px 라 24px 여백 검사는 실제 geometry bbox 로 측정 — hit rect 는
SVG 내부라 드래그 접근은 항상 가능.)
(⚠️ 위 9-viewport 수치는 옛 body-anchored 기준. **union-중심 재검증**(`43fae6c`): 1280·1600·
390 에서 **union bbox 중심 vs viewport 중심 오차 0px**, 몸판·소매 24px 여백 내, overlap 0,
소매 항상 오른쪽(dx 51.97·dy 0, 모바일 포함), 리사이즈 시 union 재중앙(오차 0), `몸판 중앙`
버튼은 몸판 중심(오차 0·zoom 유지)·union 은 오른쪽으로 벗어남, 드래그 후 리사이즈는 배치
유지, 콘솔 0.)

**미구현(경계 준수)**: 옆선 실루엣(허리 접점 큰 꺾임 연결) / 배치 저장·복원 / 몸판 offset
자동 활용 / 다중 designProject — 별도 사양·승인 후.
## ✅ Design 앞판·뒤판·소매 독립 배치 (2026-08) — piece별 offset

**배경(사용자 계약)**: design 부터 `front / back / sleeve` 를 **독립 배치**한다(draft 원형은
무변경). 이후 패턴선 도구가 "앞판선/뒤판선" 을 정확히 구분하려면 각 조각이 독립 좌표계로
배치돼 있어야 한다. 이번엔 **배치 기반만** 세우고 패턴선 도구는 다음 작업.

**핵심 결정 (잠금)**
- 배치 offset 을 `working.layout.{body,sleeve}` → **`working.layout.{front,back,sleeve}`** 로
  확장. `placement` 는 **피스별** `"auto"|"manual"`(사용자가 그 피스를 드래그하면 manual →
  이후 auto 배치에서 안 움직임). geometry 좌표 불변, 표시 offset 만.
- **shared(허리다트 c 다리)는 앞판 offset 을 따른다** — 앞·뒤가 벌어져도 붙일 곳은 하나여야
  하고 shared/outline 은 비어 있어 construction 잔재뿐이라 앞판에 귀속(render 의 `frontSub`
  가 `shared` 포함). 필요 시 뒤판으로 바꾸기 쉬움.
- **초기 배치 = 앞판 → 뒤판 → 소매 가로**, 피스 사이 **실제 봉제선(outline) 간격 10cm**
  (`autoLayout`, `outlineBBoxOf` 로 outline 만 측정), 세 피스 **세로중심을 앞판 세로중심에
  정렬**(옆으로 나란히). 앞판=앵커(0,0).
- **reference·working 에 같은 piece offset** 을 적용(회색+남색 함께 이동). 전역 z-order 유지:
  `grid → reference(front,back,sleeve) → working(front,back,sleeve) → hit(front,back,sleeve)`.
- **앞/뒤/소매 각각 독립 hit rect** → 각각 드래그(기존 body/sleeve 드래그 구조를 3피스로 확장).
- **fit = 세 피스 union 중심**을 viewport 중심에(카메라만). enterDesign·배치초기화·소매오른쪽·
  엉덩이 길이(auto 일 때)에서 auto 재배치, 리사이즈 시 재fit.

**API**: `bboxOf(front|back|sleeve|body)` (outline+construction, `PIECE_KEYS` — front=front+shared),
`outlineBBoxOf`(outline만, 간격·세로중심용), `autoLayout(geometry)`(순수: front/back/sleeve
offset), `ensureLayout`(신형 + 구형 `{body,sleeve,sleevePlacement}` 마이그레이션). DOM 액션명
(`enterDesign/centerBody/placeSleeveRight/resetLayout/afterBodyLength/resetViewForDesign`) 보존.

**변경 파일**: `js/designLayout.js`(재작성) / `js/render.js`(design 분기 front/back/sleeve +
hit rect) / `js/designProject.js`(layout 기본값). 하네스: designLayoutCheck(22)·
designProjectCheck·designRenderBranchCheck 갱신. **엔진·draft·shape/perf 골든 무변경.**
캐시 `?v=2026081010`.

**검증(격리 origin, storage 0, 저장 0, 콘솔 0)** — desktop·390:
- 앞→뒤→소매 순, **봉제선 간격 10/10cm**, 세 피스 세로중심 일치(16.858), union 중심 ≤1px
  (0/0.05·0/0.02), reference=working transform 동일.
- **앞·뒤·소매 독립 드래그**: 앞판 드래그 시 back/sleeve delta 0(무변화), 드래그한 피스만
  manual, reference=working 유지, geometry(working==reference) 불변.

**미구현(다음 작업)**: 실제 패턴선 도구(그 선이 어느 piece 소유인지 `piece:"front"|"back"`
태깅) — 이번 배치 기반 위에 별도로. shared 를 뒤판/양쪽으로 나누는 세분화도 필요 시 별도.
## ✅ Design 패턴선 도구 1차 (2026-08) — 직선, 소유권 + offset 역변환 저장 (`js/designLineTool.js`)

**배경(사용자 계약)**: 위 앞/뒤/소매 독립 배치 기반 위에 패턴선 도구를 시작한다. 1차는
**직선(두 점 클릭)**, **클릭 위치로 피스 자동 판정**(두 점이 다른 피스면 거부).

**두 핵심 원칙(잠금)**
1. **선 생성 시점에 `piece("front"|"back"|"sleeve")` 소유권 기록** — 좌표로 추측하지 않는다.
2. **현재 피스 배치 offset 을 역변환해 형상 cm 로 저장**: 화면클릭(px) →
   `eventToPatternPoint`(도안 cm, offset 미반영) → 그 피스 `layout[piece]` offset 을 **빼서**
   형상 cm 로 저장(`pointToGeometryCm`). 그래야 피스를 다시 옮기거나 배치를 초기화해도 선이
   형상에 정확히 붙어 있고, 렌더는 reference/working 과 같은 transform 을 타 자동 정합된다.
   (실측: 그린 선이 있는 앞판을 드래그해도 **저장 형상 cm 불변**·화면선은 피스와 동반 이동.)

**저장/렌더 — geometry 와 책임 분리 (★ 중요 교정)**
- ~~`working.geometry[piece].designLines`~~ → **`working.patternLines`** 별도 배열
  (`{id,piece,segments:[{kind:"line",from,to}]}`, 좌표는 형상 cm). **geometry 안에 넣으면 안 된다** —
  엉덩이 길이 적용(`ui.js:385 project.working.geometry = computeGeometry(...)`)이 working.geometry 를
  **통째 교체**하므로 그 안의 선은 사라진다. `working.geometry`=몸판 계산 결과,
  `working.patternLines`=사용자가 그린 디자인 선으로 **책임 분리**.
- 기존 outline/construction·designRenderer·shape 골든 무변경. render.js `_appendPatternLines`
  가 `working.patternLines` 를 피스별로 필터해 working 피스 그룹에 별도 append(그룹 transform
  동승). reference 엔 없음(working 전용, 세션 한정). `id`=`nextId`(기존 최대+1, 삭제 충돌 없음).
- 색: 주황(`--orange`), `.design-working .design-line`(0,1,1 인 `.design-working line` 보다
  우선하도록 working 스코프). shared 는 앞판 그룹이라 앞판에 그린 선은 front 소유.
- 두 점이 다른 피스면 **거부**(pending 유지, "같은 피스 안에서 두 점을 찍으세요").

**충돌 회피**: 선 도구 활성 중 designLayout 드래그 pointerdown 은 가드로 건너뛴다
(`window.designLineTool.isActive()`). ESC = 진행 중 첫 점 취소.

**변경 파일**: `js/designLineTool.js`(신규, `window.designLineTool` — 순수
`pointToGeometryCm/geometryToDrawCm/makeLine` + 클릭 흐름) / `js/designLayout.js`(드래그
가드) / `js/render.js`(`_appendDesignLines`) / `index.html`(design inspector `#btnDesignLine`
+ 스크립트 + 캐시) / `css/style.css`(`.design-line`). 하네스 `designLineToolCheck`(8, 순수
역변환·왕복·소유권). **엔진·draft·shape/perf 골든 무변경.** 캐시 `?v=2026081011~12`.

**검증(격리 origin, storage 0, saves 0, console 0)** — desktop:
- 앞판 두 점 클릭 → 직선 1개, `piece:"front"`, 저장 형상 cm = 클릭 도안 cm − front offset,
  **렌더 화면 위치 오차 0px**(클릭 지점 정합). afterFirstClick 0(두 번째 클릭에 생성).
- 선 있는 앞판 드래그(+50,−30) → 화면선 동일 이동, **저장 형상 cm 불변**(offset 역변환이
  피스 귀속을 보장). 다른 피스(앞→뒤) 클릭 → 선 안 생김.
- **엉덩이 길이 10→20→0 적용에도 선 유지·좌표 불변**(working.patternLines 분리 덕에
  working.geometry 통째 교체와 무관), 배치 초기화 후 유지, 선 그리기가 working.geometry
  무변경, reference frozen·무변. 주황 렌더. designLineToolCheck 12 + designProjectCheck
  patternLines 분리 검사.

**미구현(다음)**: 곡선/연속선, 선 편집·삭제·선택, snap, `piece:"sleeve"` 도 소유 가능하나
UI 상 앞/뒤 중심. 선을 outline/봉제선으로 승격하는 단계(패턴선 확정)는 별도.
(→ 연속선은 아래 "연속선(polyline)" 섹션에서 구현 완료. 곡선·편집·snap 은 여전히 미구현.)
## ✅ Design 패턴선 도구 2차 (2026-08) — 연속선(polyline) 생성

위 직선 도구 위에, **한 patternLine 이 여러 segment 를 갖는 연속선**을 구현했다. 저장 모델
(`working.patternLines` · `{id,piece,segments}` · 형상 cm · offset 역변환)은 그대로 재사용 —
2점 polyline = 기존 직선과 동일 구조라 **기존 직선 데이터도 같은 모델로 계속 렌더**.

**동작 계약(잠금)**: 첫 클릭=시작점+piece 확정 / 이후 클릭=같은 피스에 점+segment 추가 /
다른 피스·빈 영역 클릭=거부(작성 유지) / 더블클릭·Enter=완료(점 2개 미만이면 불가) /
Backspace=마지막 점 취소 / Esc=미완성 전체 취소 / **작성 중 선은 preview 일 뿐 완료 전
working.patternLines 에 커밋하지 않음**.

**구현 요점**
- `draft = {piece, points[]}`(형상 cm, 미커밋). 완료 시 `segmentsFromPoints`(연속 점 → line
  segment 배열) → `makePatternLine(id,piece,points)` 하나로 커밋. `getDraft()` 가 render.js
  preview 에 draft 복사본 제공.
- ~~**더블클릭 중복 점 처리**: 더블클릭의 두 번째 pointerdown 이 만든 중복 점을 dblclick 에서
  `points.pop()` 후 commit~~ → **폐기(회귀 수정, 아래 "더블클릭 완료 회귀" 섹션)**: 네이티브
  `dblclick` 은 매 pointerdown 의 rerender 로 DOM 이 재생성돼 **발화하지 않는다**. 이제 pointerdown
  에서 수동 감지(시간·거리 임계)로 완료한다("클릭 P1,P2 + 더블클릭 P3" = 3꼭짓점 2segment 동일).
- **preview**(render.js `_appendPatternLinePreview`): 점선(`.design-line-preview`) + 주황
  꼭짓점(`.design-line-vertex`), 그 피스 그룹 안이라 offset transform 동승. 커밋 0.
- keydown(Enter/Backspace/Esc)은 **입력 필드(INPUT/TEXTAREA/SELECT) 포커스 시 무시**(엉덩이
  길이 입력 방해 금지). designLayout 드래그는 도구 활성 시 가드로 skip.

**검증(격리 origin, storage 0, saves 0, console 0)** — desktop·390px:
- 3점 클릭 → draft 3점·preview 선2/꼭짓점3·**커밋 0**(preview만), Enter → patternLine 1개
  (2 segment). 더블클릭 완료도 3꼭짓점 2 segment(중복 제거).
- 다른 피스(앞→뒤) 클릭 거부·draft(front) 유지, Backspace 마지막 점 −1, 1점에서 Enter
  완료 불가(커밋 불변), Esc 전체 취소(preview 제거).
- 도구 OFF 후 앞판 드래그 → 커밋된 연속선 동반 이동·**저장 형상 cm 불변**.
- `designLineToolCheck`(연속선 시점 13).
## ✅ Design 패턴선 도구 3차 (2026-08) — 직선+곡선(cubic) 혼합

연속선 위에, **같은 도구에서 클릭=직선 / 클릭-드래그=곡선(베지어)**. 하나의 patternLine 에
`line`·`cubic` 세그먼트 혼합. 저장 모델(`working.patternLines`·형상 cm·offset 역변환·geometry
분리)은 그대로. 곡선 형식 `{kind:"cubic", from, c1, c2, to}`. 완료/취소 계약(Enter·더블클릭·
Backspace·Esc·2점미만 불가·다른 피스 거부·preview 미커밋)은 연속선과 동일.

**anchor 모델(핵심)**: `draft = {piece, anchors:[{p, h}]}`. `p`=점 위치, `h`=드래그가 만든
핸들 벡터(형상 cm 델타, `드래그점−p` 라 offset 상쇄)|null(클릭=모서리). 세그먼트는 anchors
에서 도출(`segmentsFromAnchors`):
- 도착 anchor.h==null(클릭) → **line** `{from,to}`
- 도착 anchor.h!=null(드래그) → **cubic**: `c1 = 출발.p + 출발.h`(출발이 곡선점이면
  부드럽게 이어짐, 모서리면 = 출발.p) / `c2 = 도착.p − 도착.h`(드래그 반대쪽=들어오는 접선).
- **세그먼트 타입은 "도착점 제스처"가 정한다** — 곡선점 뒤에 클릭하면 그 구간은 line
  (모서리). 전부 클릭이면 전부 line(= 기존 연속선).

**클릭 vs 드래그 판정**: pointerdown 이 anchor 추가 + `dragging` 시작 → pointermove 가
시작점에서 `DRAG_PX(4px)` 넘게 움직이면 마지막 anchor 에 핸들 h 설정(live), 미만이면
모서리 유지 → pointerup 확정. designLayout 드래그는 도구 활성 시 가드로 skip.

**렌더**: 커밋·preview 모두 **하나의 `<path>`**(`_patternPathD`: line→`L`, cubic→`C`).
preview 는 점선 path + 꼭짓점(`.design-line-vertex`) + **곡선 핸들선/점**(`.design-line-handle`
/`-handledot`, cyan). 기존 직선/연속선 데이터(segments)도 같은 path 렌더러로 계속 표시.

**검증(격리 origin, storage 0, saves 0, console 0)** — desktop·390px:
- 클릭 P1 → 드래그 P2(곡선) → 클릭 P3 → Enter: segments `[cubic, line]`, cubic c1=P1(모서리)·
  c2=P2−핸들·to=P2 실측 일치, 커밋 path 에 `C`·`L` 모두, 작성 중 preview 핸들선 표시·**커밋 0**.
- 더블클릭 완료(cubic+line 혼합), Backspace −1, 1점 Enter 완료 불가, Esc 전체 취소.
- 엉덩이 길이 10→20→0·앞판 드래그에도 **곡선 좌표 불변**, 곡선 path 피스 동반 이동, 다른
  피스 거부. `designLineToolCheck` 15(segmentsFromAnchors line/cubic/혼합·makePatternLine).
## ✅ Design 패턴선 도구 4차 (2026-08) — 완성 선의 선택·편집·삭제

곡선 위에, **완성된 선을 선택해 편집/삭제**. 그리기와 선택을 **명확히 분리된 모드**로 나눴다
(`mode ∈ {"off","draw","select"}`, 버튼 2개 `btnDesignLine`·`btnDesignSelect` 상호배타).

**6단계 동작 계약(잠금)**: ① 선 클릭=선택 강조 ② Delete·Backspace=선택 선 삭제 ③ 선택 선의
anchor·cubic 핸들 표시 ④ anchor 드래그=공유 이웃 세그먼트 to/from(+인접 cubic 핸들) 함께
이동 ⑤ cubic 핸들 드래그=그 c1/c2만 수정 ⑥ Esc=선택 해제.

**핵심 계약**
- **같은 anchor 를 공유하는 이웃 세그먼트의 to/from 을 반드시 함께 갱신** — `moveAnchor(line,k,dx,dy)`:
  `k>0`이면 `seg[k-1].to`(+cubic이면 `c2`), `k<n`이면 `seg[k].from`(+cubic이면 `c1`)을 동시에 delta.
  anchor 드래그는 시작 시점 `orig` 스냅샷에서 **총 delta** 로 재계산(증분 누적 오차 없음).
- **편집 좌표도 피스 offset 역변환 후 형상 cm** 로 저장(`geoAt`=eventToPatternPoint−offset).
- **선택 상태는 세션 UI 상태**(`selectedId`) — working.patternLines 에 저장 안 함(선 데이터에 흔적 0).
- reference·geometry·**다른 선 불변**. 피스 이동·엉덩이 길이 재계산에도 선 좌표 불변.
- **작성 중(draw)에는 선택 차단** — 모드가 분리돼 있어 select 로직은 select 모드에서만 동작.
  isActive()=mode!=="off" 라 draw·select 모두 designLayout 피스 드래그를 가드로 막는다.

**히트 테스트(순수)**: 클릭 형상 cm 에서 — 선택 선의 핸들(`NODE_HIT_PX 9`)→anchor(9)→그 외
가장 가까운 선(`LINE_HIT_PX 7`, 없으면 해제). `distToSegment`(line 정확·cubic 16샘플)·
`distToLine`·`anchorsFromSegments`·`handlesOf` 로 계산. px 임계는 `1/(SC·viewZ)` 로 cm 환산.

**렌더**: 선택 선 path 에 `.selected`(cyan 굵게). overlay=anchor 점(`.design-line-anchor`) +
cubic 핸들선/점. render.js `_appendSelectionOverlay`(피스 그룹 안 → offset transform 동승).

**검증(격리 origin, storage 0, saves 0, console 0)** — desktop·390px:
- 그리기→선택 토글 시 mode 전환·버튼 aria-pressed 상호배타. 선 클릭→`selectedId`·강조·anchor 3·
  handle 2, **선택은 patternLines 에 없음**.
- anchor 1(공유) 드래그→`seg0.to==seg1.from` 함께 이동·인접 c2 동반·delta 정확. cubic 핸들
  드래그→c1만 커서로, c2/to 불변.
- Esc 해제, Delete→선 삭제·다른 선 생존·격리·선택 해제. 엉덩이 길이 10→20→0·피스 드래그에도
  전체 선 좌표 불변, reference frozen. `designLineToolCheck` 23(anchorsFromSegments/moveAnchor
  공유끝점/distToSegment line·cubic).
## ✅ Design 패턴선 도구 5차 (2026-08) — anchor snap(흡착)

편집 위에, **anchor 에만 snap**(cubic 핸들은 곡률·방향 제어점이라 흡착 시 곡선이 망가지므로
제외). draw 의 새 anchor·select 의 anchor 이동에 **동일 적용**. 각도 고정(수평·수직·45°)은 별도.

**우선순위 캐스케이드(잠금)** — 같은 피스·working geometry 기준, 상위 tier 에 임계 내 후보가
있으면 그 tier 최근접을 쓴다(격자는 최저 폴백). `chooseSnap(cursor, sources, thr, grid)`:
1. **기존 패턴선 anchor**(자기 자신 제외) → 2. **working geometry 끝점·semantic junction**
   (outline+construction primitive 의 on-curve 점) → 3. **working outline 최근접점**
   (`nearestOnSegs`) → 4. **0.5cm 격자**.
   - ★ **cubic 최근접점은 adaptive de Casteljau flattening**(`flattenSegment`, designBodice
     교차검사와 **동일 경계** FLAT_TOL=1e-4·최대 depth 16)으로 계산한다. 고정 16분할은 최근접점이
     샘플 선분(현) 위에 흡착돼 실제 곡선에서 벗어나므로(패턴 좌표에서 봉제선 연결에 오차가 남음)
     쓰지 않는다. **snap 최근접점(`nearestOnSegs`)과 선 선택 hit-test(`distToSegment`)가 같은
     `flattenSegment` 경계를 공유**한다.
- **화면 8px 이내에서만 흡착**(`SNAP_PX=8`), zoom→cm 환산(`thr=8·(1/(SC·viewZ))`).
- **Alt** 누르면 해제(자유). **cubic 핸들 드래그는 snap 없음**(자유). **다른 피스·소매 후보 금지**
  (`patternAnchorPts`/`geomEndpoints`/`outlineSegsOf` 가 `PIECE_GEOM_KEYS[piece]`만 스캔).
- **reference 아님, working geometry(실제 결과) 기준.**

**적용/표시**: draw pointerdown 이 새 anchor 를 `snapForCursor` 로 흡착, draw hover(pointermove
무버튼)가 다음 anchor 흡착 미리보기, select anchor 드래그는 `origAnchor + delta` 를 흡착(자기
anchor 제외). 흡착점은 cyan 링(`_appendSnapHint`) + note "흡착 → 기존 anchor/형상 끝점/외곽선/
격자 0.5cm". snapHint 는 세션 UI 상태(patternLines 미저장), pointerup·모드전환에 해제.

**검증(격리 origin, storage 0, console 0)** — desktop:
- draw 새 anchor: A 근처(5px) 클릭 → 기존 anchor A 로 정확 흡착. Alt 클릭 → 해제(커서 위치).
- select anchor 드래그 → A 흡착, hint type "anchor"·cyan 렌더. cubic 핸들 드래그 → **흡착 안 됨**
  (커서에 자유), hint 없음. draw hover → snapHint(anchor)·cyan. working geometry **끝점 흡착**
  (type endpoint). `designLineToolCheck` 36(chooseSnap 우선순위·임계·격자 폴백·closestOnSeg·
  nearestOnSegs + cubic 정밀도).
- **cubic 정밀도(정밀 보완)**: 고곡률 cubic 에서 16분할 꼭짓점 사이가 최근접인 fixture —
  adaptive 결과가 **실제 cubic 위(오차<1e-3)** 이고 실제 최근접과 일치, 고정 16분할은 곡선에서
  **5배 이상** 벗어남(정밀도 개선 실증). 실브라우저: front cubic outline 근처를 두 zoom
  (0.99·1.88)에서 흡착 → **동일 저장 좌표**(44.8291,2.33769)·실제 곡선 오차 4.4e-4(4000샘플
  측정 해상도 한계 내)·type outline. `distToSegment`(선 hit-test)도 같은 flatten 경계로 정밀.
## ✅ Design 패턴선 도구 6차 (2026-08) — Shift 핸들 각도 고정(45°)

snap 위에, **핸들 드래그 중 Shift = anchor 기준 가장 가까운 45° 배수로 각도 고정**(길이는
커서 거리 유지). 별도 버튼 없이 보조키. draw click-drag 핸들·select c1/c2 편집 **모두 적용**.

**계약(잠금)**
- **각도만 45° 배수(0·45·90·135·180…)로 고정, 길이는 현재 커서 거리 유지** —
  `constrainAngle45(dx,dy)`: 벡터 각도를 `round(atan2/45°)·45°` 로 스냅, `len` 보존. 순수.
- **Shift 놓으면 즉시 자유 복귀** — pointermove 는 매번 `e.shiftKey` 반영, 추가로
  keydown/keyup(Shift)가 **마우스 정지 상태에서도** 마지막 커서(`lastHandleGeo`)로 즉시 재계산
  (`onShift`, `_handleShift` 로 중복 방지).
- **anchor snap 과 분리** — 핸들은 **위치 snap 없음**(각도 고정만). anchor snap 은 그대로.
- **선택한 c1 또는 c2만 변경, 반대쪽 강제 대칭 없음**(c1 은 seg.from, c2 는 seg.to 기준 각도).
- **도안 cm(피스 offset 제거) 벡터로 각도 계산** → zoom·offset 독립.
- 작성·편집 중 note "핸들 45° 각도 고정 (Shift)" / "… Shift = 45° 고정" 안내.

**검증(격리 origin, storage 0, console 0)**:
- draw: Shift 드래그 → 각도 0°(45배수), **길이 = 자유 드래그 길이(보존)**. Shift keydown 즉시
  고정·keyup 즉시 자유 복귀(마우스 정지 상태에서도). select: c2 핸들 Shift → 90°(45배수),
  **c1 불변**(반대쪽 강제 대칭 없음). `designLineToolCheck` 50(수평·수직·±45·135·경계각
  30→45/20→0·45배수 전수·길이 보존·offset 독립).
## ✅ Design 패턴선 역할(role) 지정 1차 (2026-08) — 표시 구분까지

그린 선은 화면 디자인 선일 뿐 실제 패턴 외곽/절개선이 아니다. **선택한 선에 역할을 부여**한다.
이번은 **역할 선택 + 표시 구분까지만**, 실제 outline 분할은 다음 단계(파트 분리).

**데이터**: `{ id, piece, role: "cut"|"boundary"|"guide", segments }`.
- `cut`(절개선)=몸판을 여러 조각으로 나눌 선 / `boundary`(외곽 대체선)=네크라인·옆선·밑단 등
  교체 / `guide`(보조선)=형상 분리에 안 쓰는 참고선. **새 선은 `guide`로 시작**(makePatternLine
  기본), 선택 후 지정.

**표시 구분(CSS `data-role`)**: cut=빨강(#cc3333) 점선 / boundary=navy 실선(굵게) /
guide=주황 얇은 점선(참고). **선택 중엔 `.selected`(cyan 실선)가 역할색을 덮는다**(편집 강조 우선,
해제 시 역할색 복귀).

**UI**: design inspector 에 역할 버튼 3개(`btnRoleCut`/`btnRoleBoundary`/`btnRoleGuide`).
선택 선이 있을 때만 활성(`syncRoleButtons`), 현재 역할 `aria-pressed`. `designLineTool.setRole`
이 선택 선의 role 만 바꾼다(세션 UI 상태 아님 — patternLines 에 저장). 선택/해제/삭제/모드전환에
버튼 상태 동기화.

**검증(격리 origin, storage 0, console 0)**: 새 선 기본 role=guide(주황 점선), 선택 시 역할버튼
활성·현재 역할 강조, cut→data-role=cut·해제 시 **빨강 점선**, boundary→해제 시 **navy 실선**,
role 이 patternLines 에 저장, Esc 해제 시 버튼 비활성. `designLineToolCheck` 52(makePatternLine
role 기본 guide·명시 role). 엔진·draft·골든 무변경.

**다음(별도 단계)**: `cut` 양 끝이 같은 피스 외곽선에 정확히 snap 됐는지 검증 → 실제 outline
분할(파트 분리). `boundary` 는 기존 외곽 교체 로직.
## ✅ Design 절개선 유효성 검사 (2026-08) — 분할 전 독립 검증 단계

역할 지정 위에, **outline 을 자르기 전에 절개선이 실제로 분할 가능한지 독립 검사**한다.
**geometry 를 바꾸지 않고 UI 상태로만** 표시. ★ **snapHint(세션 UI)를 근거로 쓰지 않고,
현재 working outline 좌표·교차를 다시 계산**한다(사용자 핵심 지시).

**검사 조건(순수 `validateCut(cutLine, outlineFlat, otherCutsFlat, opts)`)** — 순서대로, 첫
실패의 구체 이유 반환:
1. `role==="cut"` 아님 → "절개선이 아님"
2. 시작/끝점이 현재 working outline 위(거리 ≤ `onTol` 0.05cm) → "시작점/끝점이 외곽선에 연결되지 않음"
3. 두 끝점이 서로 다름(≥ `minSep` 0.1cm) → "시작점과 끝점이 같음"
4. 자기 교차(비인접 세그먼트) → "절개선이 자기 자신과 교차"
5. 중간이 outline 에 추가로 닿음(끝점 접촉 제외) → "절개선 중간이 외곽선에 닿음"
6. outline 따라가는 중복(내부 샘플 전부 outline 위) → "외곽선을 따라가는 중복 선"
7. 기존 cut 과 교차 → "다른 절개선과 교차"
→ 전부 통과 시 `{ok:true, reason:"분리 가능"}`.

- **cubic 교차·거리 판정은 기존 adaptive de Casteljau `flattenLine`(FLAT_TOL 1e-4) 재사용**
  (snap·hit-test 와 동일 경계). `segCross`(proper/touch), `distPtToSegs`, `nearAny` 순수 보조.
- `validateSelectedCut()`: 선택 cut 을 현재 `working.geometry` outline(`outlineSegsOf`, path→cubic
  변환)·같은 피스 다른 cut 기준으로 검사. `syncCutStatus` 가 `#designCutStatus` 에 "분리 가능"
  (녹색)/실패 이유(빨강) 표시. 선택·역할변경·삭제·모드전환에 갱신, **`revalidate()` 는 ui.js
  `onApplyBodyLength`(geometry 재계산)에서 호출**.
- **유효한 cut(`ok`)만 다음 단계 파트 분리 함수가 소비**(validateSelectedCut 노출).

**검증(격리 origin, storage 0, console 0)**: 실제 앞판 outline 에 중앙 세로 절개선(위 -2.12·
아래 38 두 점만 교차 = 내부) → "분리 가능". 시작점 3cm 안쪽 → "시작점이 외곽선에 연결되지
않음"·복원 시 재통과. 검사가 geometry 무변경. **엉덩이 길이 10 적용(geometry 재계산) → 재검사
자동 갱신 "끝점이 외곽선에 연결되지 않음"**(waist 가 내려가 끝점이 내부화), **선 좌표는 불변**,
0 복원 → "분리 가능". 하네스 `designLineToolCheck` 62(유효·role아님·양끝미연결·동일·자기교차·
중간접촉·outline중복·기존cut교차·cubic 유효).

**다음(별도 단계)**: 유효 cut 을 실제로 **outline 두 폐곡선으로 분할**(파트 분리).
## ✅ Design 파트 분리 1차 (2026-08) — 유효 절개선으로 두 폐곡선 생성

유효성 검사 위에, 선택된 유효 절개선 1개로 outline 을 **두 폐곡선(파트)으로 분할**한다.
원본 `working.geometry`·`patternLines` 는 안 건드리고 결과만 별도 `working.parts` 에 저장,
서로 다른 색 미리보기까지. 파트명·수량·식서·시접 UI 는 후속.

### ★ 발견: outline 은 깨끗한 폐곡선이 아니다 — 열린 다트 입구 (실측)
front/back outline 은 **열린 다트 입구 gap** 을 하나씩 갖는다(단일 폐곡선 아님):
앞=가슴다트 3.72cm(진동선을 상·하로 가름), 뒤=어깨다트 1.79cm. 자유단(입구점)은 정확히
**2개**이고, construction 에 **다트 다리(입구→apex→입구)** 가 있으며 그 끝점이 자유단과
**정확히 일치(dist 0)** 한다. 허리다트는 waist outline 이 실선이라 construction 참고선일 뿐
(outline 안 끊음). **사용자 결정: ① 다트 다리로 닫아 물리적 폐곡선 구성 ② 1차는 절개선이
다트와 상호작용(끝점이 다리 위·다트 V 가로지름)하면 거부.**

### 알고리즘 (순수, `js/designLineTool.js`)
- **`buildPieceRing(outlineSegs, constrLines)`**: outline 을 인접(RING_EPS=0.02cm)으로 단일
  열린 체인으로 잇고(내부 junction 은 정확 공유로 drift 제거), 자유단 2개를 construction
  다트 다리로 닫아 폐곡선 `ring:[{seg, source:"outline"|"dartleg"}]` 반환. 자유단이 2개가
  아니거나 체인이 안 이어지면 토폴로지 예외로 실패.
- **`splitRingByCut(ring, cutSegs)`**: 절개선 두 끝점을 ring 에 투영(cubic 은 40샘플+Newton),
  두 arc 를 forward 로 추출해 `arcA+cutRev` / `arcB+cutFwd` 두 폐곡선 생성.
  - **1차 거부(다트 상호작용)**: 끝점이 dartleg 세그먼트 위 → "끝점이 다트 다리 위 — 후속",
    절개선이 dartleg 를 가로지름 → "다트를 가로지름 — 후속".
  - 검증: 연속성·폐곡선 오차 ≤1e-4(CLOSE_EPS)·자기교차 0·면적≥0.01·**두 파트 방향(부호)이
    ring 과 일치**. 하나라도 실패 시 전체 실패(working.parts 불변).
- **★ 곡선 보존(핵심 계약)**: flatten(adaptive de Casteljau, FLAT_TOL 1e-4)은 **교차·검증·면적
  에만** 쓴다. 실제 파트 outline cubic 은 투영 parameter t 에서 **de Casteljau 로 정확 분할**
  (`subSegment`→`_cubicBetween`, split@t1 후 split@t0/t1). 폴리라인으로 저장하지 않는다.
  arc 끝점과 cut 끝점 모두 **동일 투영점**(`_evalSeg`==de Casteljau)이라 연결오차 **정확히 0**.
  cut 끝점만 투영점으로 강제(≤onTol 0.05 nudge)하고 내부 제어점은 불변.

### DOM·저장·무효화
- `doSplit()`(버튼 `#btnDesignSplit`): mode select + 유효 cut(front/back) 선택 시에만 활성
  (`syncSplitButton`←`validateSelectedCut`). **분할 직전 `validateSelectedCut()` 재실행** →
  `buildRingForPiece` → `splitRingByCut` → **성공 후에만** `working.parts` 원자적 교체.
  실패 시 `#designSplitNote` 에 사유만(parts 불변).
- `working.parts = [{id:"part-1", sourcePiece, sourceCutId, outline:[segs]}, {id:"part-2", …}]`
  (한 절개선 → 두 파트). 좌표는 형상 cm(원본과 동일 좌표계).
- **무효화**: geometry·절개선 변경 시 `invalidateParts()` 로 즉시 비움 — commitDraft/
  deleteSelected/setRole/편집 드래그 종료/`revalidate`(ui.js `onApplyBodyLength`, 엉덩이 길이
  재계산). 무효화 후 render 가 parts 레이어 제거.
- **렌더(`render.js` `_appendParts`)**: working 위·hit layer 아래 `data-design-root="parts"`,
  각 파트 닫힌 path 를 소속 piece offset transform 동승. 두 색: `data-part-index` 0=청록
  #0EA5A5 / 1=자주 #C026A9(옅은 fill+stroke). render.js 라이브 원형 경로·shape 골든 무변경.

### 검증 (격리 origin 127.0.0.1:8420, storage 0, saves 0, console 0)
- **실제 front/back 알고리즘**: front ring 11(outline 9+dartleg 2)·back ring 10(8+2), 분할
  성공, 두 파트 폐곡선 **오차 0**, **cubic 유지(곡선 보존)**, geometry/working 무변경.
- **UI 경로**: 절개선(role cut) 선택→"분리 가능"→버튼 활성→분할→`working.parts` 2개
  (오차 0)·원본 geometry/patternLines **무변경**·2색 path 2개 렌더·스크린샷(청록 상단[가슴다트
  V 포함]+자주 하단 strip, 뒤판·소매 무영향).
- **무효화**: 엉덩이 길이 적용 → parts 2→0·parts 레이어 제거. **다트 가로지르는 절개선(x=35
  가슴다트 관통) 거부**("다트를 가로지름 — 후속").
- 하네스 `designLineToolCheck` **79**(파트 분리 17: 링 구성·다트 닫힘·폐곡선 정확 닫힘·분할·
  두 파트·오차 ≤1e-4·면적 96(사각형−다트노치)·양끝 동일 거부·다트 가로지름 거부·cubic 분할·
  곡선 보존·`subSegment` de Casteljau 정확·reverseSeg). runAll 전체 통과, shape/perf 골든 diff 0.
  캐시 `?v=2026081201`(designLineTool·render·css).

**미구현(다음)**: 다트 상호작용 절개선(끝점 다리 위·다트 가로지름) 지원 / 소매 / 다중 절개 /
파트명·수량·식서·시접·재단 UI / 파트를 실제 재단 조각으로 확정.
> ⚠️ **`working.parts` 는 ⑤ 재단 단계의 최종 조각이 아니라 Design 단계의 파생 미리보기다**
> (사용자 확정). 파트명·수량·식서·시접으로 확장하지 않는다.
## ✅ Design 외곽 대체선(boundary) 1차 (2026-08) — 짧은 arc 교체 파생 미리보기

파트 분리 인프라 위에, `boundary` 역할 선으로 outline 의 **짧은 arc(네크라인·옆선·밑단)를
교체**한 파생 외곽선을 만든다. 원본 `working.geometry`·`patternLines` 불변, 결과는 별도
파생 미리보기 `working.boundaryPreview` 로만 표시(다른 색). 대체선 자체는 outline 승격 안 함.

### 결정·계약 (잠금)
- **대체 arc = 짧은 arc**(사용자 확정): 두 끝점 사이 outline 호 길이가 짧은 쪽을 교체,
  긴 쪽 유지. 네크라인(SNP↔FNP)·옆선(진동밑↔옆밑단)·밑단(중심↔옆)이 모두 짧은 feature arc.
- **1차 거부**: 끝점이 다트 다리 위 → "끝점이 다트 다리 위 — 후속" / 대체 arc 가 다트 다리
  포함 → "대체 arc 가 다트를 포함 — 후속" / 두 arc 길이 유사(비율>0.9) → "대체할 arc 가
  모호함". (다트가 **유지 arc** 에 있으면 정상 — 네크라인 등 대부분.)
- **파트 분리 인프라 재사용**: `buildPieceRing`(다트 다리로 닫은 폐곡선 ring)으로 면적·방향·
  교차를 판정. `extractArcTagged`(source 태깅)로 짧은 arc 의 다트 포함 판정·유지 arc 의
  dartleg 제거를 한다.
- **★ 파생 outline 은 다트 입구를 열어둔다**: 유지 arc 에서 **dartleg 세그먼트를 제거**하고
  outline 만 남겨(원본과 동일하게 다트 입구 open) 대체선과 이어 저장. 검증용 폐곡선(테스트
  루프)은 dartleg 포함해 닫아 자기교차·면적·방향을 확인.
- **곡선 보존**: 대체 arc 를 잘라내는 지점의 outline cubic 은 `subSegment`(de Casteljau)로 정확
  분할, 유지 arc 의 cubic 은 그대로. flatten 은 교차·길이·검증에만.

### 유효성·미리보기·무효화 (`js/designLineTool.js`)
- **`replaceArcOnRing(ring, boundarySegs)`**(순수): 끝점 투영(outline 위·다트 아님) → 짧은 arc
  선택 → 모호·다트·자기교차·유지경계 교차·결과 폐곡선(단순·면적>0·방향) 검증 → `{ok,
  outline:[대체선+유지 outline]}`. 대체선 끝점은 유지 arc 끝점으로 강제(연결오차 0).
- `validateSelectedBoundary()`: 선택 boundary 선을 현재 working outline 기준 검증(파생 outline
  동반). `#designBoundaryStatus` "대체 가능"(녹색)/실패 이유(빨강), `#btnDesignBoundary` 활성.
- `doBoundaryPreview()`(버튼): **직전 재검증** → 성공 시에만 `working.boundaryPreview =
  {sourcePiece, sourceLineId, outline}` 원자적 저장 → 렌더.
- **무효화**: geometry·선 변경 시 `invalidateParts`(이제 parts+boundaryPreview 둘 다 비움) —
  commitDraft/deleteSelected/setRole/편집 드래그 종료/`revalidate`(엉덩이 길이).
- 렌더(`render.js` `_appendBoundaryPreview`+`_openPathD`): 파생 outline 을 인디고 #6D28D9 로,
  **불연속(다트 입구)에서 새 subpath(M)** → 가짜 연결선 없음. 소속 piece offset transform 동승.

### 버그 수정 (이 사이클)
`syncCutStatus` 의 `if(!v)` 조기반환(절개선 아님 = **boundary 선택 시**)에서 `syncBoundaryStatus()`
를 안 불러, boundary 선을 선택해도 상태·버튼이 안 켜졌다. 두 분기 모두에서 호출하도록 수정
(실측: 수정 전 status 빈칸·버튼 disabled → 수정 후 "대체 가능"·활성).

### 검증 (격리 origin, storage 0, saves 0, console 0)
- **실제 앞판**: 네크라인(FNP↔SNP) 직선 대체 → 파생 outline 9세그·**cubic 보존**. 진동선
  전체(다트 포함) 대체 → **"대체 arc 가 다트를 포함" 거부**.
- **UI 경로**: boundary 선 선택→"대체 가능"→버튼 활성→미리보기→`working.boundaryPreview`
  저장(9세그)·원본 geometry/patternLines **무변경**·인디고 path 1개·스크린샷(원본 곡선 네크라인
  위에 직선 파생, 다트 입구 열림 유지, 뒤판·소매 무영향).
- **무효화**: 엉덩이 길이 적용 → boundaryPreview 삭제.
- 하네스 `designLineToolCheck` **89**(외곽 대체 10: 짧은 arc 대체·파생 다트열림·대체선 포함·
  끝점 미연결·다트 포함 거부·모호 거부·cubic 보존). runAll 전체 통과, shape/perf 골든 diff 0.
  캐시 `?v=2026081301`(render·css)·`?v=2026081302`(designLineTool).

**미구현(다음)**: 다트 상호작용 대체선 / 소매 / 다중 대체선 / 대체 결과를 실제 outline 으로
확정(현재는 파생 미리보기). `working.boundaryPreview` 도 parts 처럼 **파생 미리보기**이며 원본
outline 을 대체하지 않는다.
## ✅ Design 외곽 대체선 합성(designOutline) (2026-08) — 여러 대체선 → 디자인 외곽

boundary 1차 위에, 같은 피스의 **여러 유효 대체선을 합성**해 하나의 디자인 외곽선
`working.designOutline` 을 만든다(블라우스: 네크라인·옆선·밑단 동시 변경). 이게 생겨야 "그린
디자인선으로 만든 실제 몸판 외곽" 이 되고, **cut/parts 가 이 합성 외곽 기준으로** 검증·분할된다.

### 결정·계약 (잠금)
- **원본 ring 기준 한 번에 합성 → 순서 무관**: 각 대체선의 짧은 arc 를 **원본 ring 의 position
  구간**으로 표현, 유지 구간엔 원본 outline 서브세그먼트(dartleg 제거=입구 열림), 대체 구간엔
  대체선을 삽입. 구간 집합으로 결정되므로 적용 순서와 무관하고, **정준 정렬**(`_canonKey`)로
  반환 배열까지 순서 무관(실측: `[b1,b2]`==`[b2,b1]`).
- **대체 구간 겹치면 거부**("대체 구간이 겹침", `_rangesOverlap` — 세그먼트별 [t0,t1] 양의 길이
  교차). 개별 대체선이 무효(다트 포함·모호·끝점 이탈 등)면 그 사유로 거부.
- **합성 결과 재검증**: 합성 outline + 원본 다트 다리로 `buildPieceRing` → 폐곡선 재연결·면적>0·
  자기교차 0 확인. 통과해야 저장.
- **cut/parts 재라우팅**: `currentOutlineSegs(p, piece)` = designOutline 있으면 그것, 없으면 원본.
  `validateSelectedCut`·`buildRingForPiece`(cut·split 공용)가 이걸 쓴다. **boundary 합성은 원본
  ring 기준**(대체선은 원본 arc 를 대체하므로), **cut/split 은 합성 outline 기준**으로 분리.
- **원본 `working.geometry`·`patternLines` 불변**, 결과는 `working.designOutline={front,back}`
  (`{outline, lineIds}`). front/back 만(소매 후속).
- **무효화**: geometry·선 변경 시 `invalidateParts`(이제 parts·boundaryPreview·**designOutline**
  셋 다 비움). 합성 성공 시 parts·boundaryPreview 는 정리(원본 기준이라 stale), designOutline 유지.

### 순수·DOM (`js/designLineTool.js`)
- `_boundaryPlan(ring, segs)`: 단일 대체선 계획(끝점 투영·짧은 arc·다트/모호/교차 검증 + 대체
  arc position 구간 aPos/bPos + 방향·끝점 강제 bnd). `replaceArcOnRing`(단일)·`composeDesignOutline`
  (다중)이 공유 → 동작 일치.
- `composeDesignOutline(ring, boundaryList)`(순수): 위 계약 전부. `_intervalRanges`(position 구간→
  세그먼트별 [t0,t1]) + `_rangesOverlap` + 세그먼트별 covered 빼기 + 대체선 삽입 + 재검증 + 정준 정렬.
- `doComposeDesignOutline()`(버튼 `#btnDesignCompose`, boundary 존재 시 활성): front·back 각각
  **원본 ring** 으로 `composeForPiece` → 한 피스라도 실패 시 전체 중단(저장 안 함) → 성공 시
  `working.designOutline` 원자적 저장. 렌더(`render.js` `_appendDesignOutline`)는 에메랄드 #0E9F6E.

### 검증 (격리 origin, storage 0, saves 0, console 0)
- **실제 앞판 네크라인(직선)+밑단(굽은 cubic) 합성** → `designOutline.front`(9세그·lineIds
  [line-1,line-2])·원본 geometry/patternLines **무변경**·에메랄드 path 1개·**스크린샷**(직선
  네크라인+굽은 밑단, 다트 입구 열림, 뒤판·소매 무영향).
- **cut 재라우팅(핵심)**: 합성 네크라인·밑단 위 점을 잇는 cut → **합성 기준 "분리 가능"(분할
  성공 2파트)** vs **원본 기준 "연결 안 됨"**(같은 cut). cut/parts 가 합성 outline 위에서 검증됨.
- **무효화**: 엉덩이 길이 적용 → designOutline 삭제.
- 하네스 `designLineToolCheck` **98**(합성 9: 다중 합성·두 대체선 포함·다트 열림·**순서 무관**·
  겹침 거부·개별 무효 거부·cubic 보존). runAll 전체 통과, shape/perf 골든 diff 0.
  캐시 `?v=2026081303`.

**미구현(다음)**: 다트 상호작용 대체선 / 소매 / designOutline 을 실제 재단 outline 으로 확정 /
합성 결과 위에서 다트이동·추가 디자인. `working.designOutline` 은 여전히 **파생 데이터**이며 원본
geometry 를 대체하지 않는다(cut/parts 검증 기준으로만 사용).
## ✅ 더블클릭 완료 회귀 수정 (2026-08) — 네이티브 dblclick → pointerdown 수동 감지

**증상(실제 Pages)**: 패턴선을 **더블클릭으로 완료**하면 작성 중 preview 는 그대로인데 완성선이
`working.patternLines` 에 저장되지 않아 안 보였다. Enter 완료는 정상.

**진단(합성 이벤트 아님, 실제 마우스로 Pages·로컬 재현)**: `computer` 실클릭 + 실제 더블클릭에서
`dblclick` 이벤트가 **svg·document 모두 0회 발화**(capture phase 포함), draft 만 늘고 커밋 0.
- **근본 원인**: draw 의 매 pointerdown 이 `rerender()` 로 **SVG DOM(hit rect 포함)을 전부 재생성**
  한다. 브라우저 네이티브 더블클릭 감지는 "**같은 target 요소**를 두 번 클릭"을 요구하는데, 두
  클릭 사이 rerender 가 target 을 새 요소로 바꿔 **`dblclick` 이 아예 발화하지 않는다**. Enter 는
  document keydown 이라 DOM 재생성과 무관해 정상.
- **왜 하네스·합성 이벤트로 안 잡혔나**: 하네스는 pointer 핸들러(`typeof svg !== "undefined"` 가드)
  를 실행하지 않고, 합성 테스트는 `dblclick` 을 **직접 dispatch** 해 네이티브 감지를 우회했다
  (그래서 "로컬 통과"만으로는 놓친다 — 실제 마우스 실측이 필수였다).

**수정(`js/designLineTool.js`)**: 네이티브 `dblclick` 리스너 제거, **pointerdown 에서 수동 더블클릭
감지**. `lastDown={t,x,y}` 를 기록하고, 새 pointerdown 이 `DBLCLICK_MS(400ms)` 이내 +
`DBLCLICK_PX(6px)` 이내면 더블클릭 완료로 판정 → 이번(두 번째) 눌림은 중복점이라 추가하지 않고
현재 draft 를 그대로 `commitDraft()`(≥2 anchors 필요). `lastDown` 은 commitDraft/setMode/Escape 에서
리셋. **rerender 로 DOM 이 바뀌어도 pointerdown 자체는 계속 발화하므로 견고**하다.

**검증(실제 마우스, 로컬 수정본 2026081304)**:
- **실제 더블클릭 완료**: 2점 클릭 + 더블클릭 → `patternLines` **+1**(3꼭짓점 2segment)·preview 제거·
  DOM `.design-line`·**화면 표시(주황, onScreen)**·draft 정리·오류 0.
- Enter 2점/3점·곡선 click-drag 정상, **오검출 없음**(6px 초과로 떨어진 3점 연속 클릭 → 정상 3점선,
  더블클릭 오완료 안 됨), 완료 후 render·엉덩이 길이·piece 이동에도 좌표·표시 유지.
- runAll 전체 통과(pointer 핸들러는 가드로 하네스 미실행 → 무영향), shape/perf 골든 diff 0.
  캐시 `?v=2026081304`(designLineTool).

**교훈**: **매 입력마다 DOM 을 통째로 재생성하는 UI 에서는 네이티브 `dblclick`(및 요소 identity 에
의존하는 이벤트)을 신뢰하면 안 된다.** 실제 마우스 실측 없이 합성 dispatch 로만 검증하면 이 계열
회귀를 놓친다.
## ✅ 도구 우선순위 게이트 (2026-08) — 선 도구 vs 배치 드래그 포인터 충돌 잠금

**배경(사용자 확정)**: 선 도구(designLineTool)와 배치 드래그(designLayout)가 **같은 svg
pointer 이벤트를 동시에** 받는다(둘 다 svg 에 pointerdown 리스너). 최상단 hit rect 는
선 도구의 피스 판정에 필요하므로 **제거하면 안 되고**, 배치 핸들러만 **선 도구 off 일 때만**
동작하도록 강한 게이트로 잠근다. (이벤트 등록 순서나 CSS `pointer-events:none` 의존 금지 —
선 그리기까지 막힌다.)

**계약(잠금)**
- **`layoutDragAllowed()` = `!designLineTool || getMode()==="off"`**. designLayout pointerdown
  시작점에서 이 게이트가 실패하면 즉시 return(배치 드래그 시작 안 함).
  - `mode==="draw"` → 선 그리기만 / `mode==="select"` → 선·anchor·handle 편집만 /
    `mode==="off"` → 앞판·뒤판·소매 배치 드래그.
- **드래그 중 모드 전환 취소(기존 갭)**: off 에서 드래그를 시작한 뒤 선 도구를 켜면 예전엔
  드래그가 계속됐다(pointermove 가 mode 를 안 봄). 이제 (1) `designLineTool.setMode` 가
  `designLayout.cancelLayoutDrag()` 를 호출하고, (2) designLayout pointermove 도
  `layoutDragAllowed()` 가 깨지면 `cancelLayoutDrag()` → **layout 좌표 변경 없이** 드래그
  상태·pointer capture 만 정리. drag 에 `pointerId` 를 저장해 정확히 release.
- **hit rect 유지**(제거 금지) — 선 도구의 front/back/sleeve 판정에 필요.

**검증(실제 마우스, 로컬 2026081305)** — 사용자 7기준:
1. 선 그리기 활성 → 앞판 click·drag 해도 `working.layout.front` **불변**(dx/dy 0, placement auto).
2. 선택·편집 활성 → 드래그해도 layout **불변**.
3. 도구 off → 배치 드래그 **정상**(dx/dy 변경, placement manual).
4. 선 작성 중 피스 안 움직임(offset 불변) → **클릭 좌표=preview 위치 일치**.
5. Enter 완료 → 선 유지·`patternLines +1`.
6. **실제 더블클릭 완료도 동일**(+1, 2 segment, 화면 표시).
7. 콘솔 오류 0.
- 추가: off 드래그 중 draw 로 전환 → 전환 전 이동만 반영, **전환 후 이동 무시**(즉시 취소).
- runAll 98 PASS(designLayout drag 핸들러는 `typeof svg` 가드로 하네스 미실행), shape/perf
  골든 diff 0. 캐시 `?v=2026081305`(designLayout·designLineTool).

**연결**: 이 충돌은 "더블클릭 완료 회귀"(위 섹션)와 별개지만, 배치가 함께 움직이면 offset 이
바뀌어 완료선이 다른 위치로 가 "사라진 듯" 보일 수 있어 함께 잠갔다. 두 수정 후 실제 마우스로
선 소멸 재현 안 됨.
