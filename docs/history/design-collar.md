# Design 카라 이력

> 셔츠 칼라 C1~C3·완료 체크포인트·교재 M형 기본형(2026-08~09).

> 이 파일은 **완료된 작업의 이력**이다. 매 세션 로드되지 않고 필요할 때만 읽는다.
> 살아있는 계약은 [../../CLAUDE.md](../../CLAUDE.md), 색인은 [../INDEX.md](../INDEX.md).

## ✅ 카라 모양 C1 — 셔츠 칼라 스탠드 스캐폴드 (2026-08)

소매 모양 단계 완료 후 카라 모양 단계 착수. 첫 카라 = **2피스 셔츠 칼라**(스탠드 + 본체), 권장 순서
**C1 스탠드 → C2 본체 → C3 직접 편집**. C1 은 **스탠드 직선 스캐폴드**만 구현했다. 순수 모듈(C1a,
`914b69f`)과 UI 배선(C1b, `aeca05b`)을 분리 커밋. 캐시 `?v=2026082501`.

### 확정 계약·경계 (위반 금지)
- **C1 = 직선 스탠드 스캐폴드다.** 길이=반패턴 합계, 높이 기본 3cm 직선 밴드 + CF 여밈 연장.
  **스탠드 베이스 곡률·CF 훅업은 없다**(이후 수치 파라미터로 확장 — 옆선 박스형→곡선화 증분과 같은 결).
- **목둘레 봉제 구간과 앞여밈 연장 구간을 분리한다.** `seamLenCm` = 목둘레 봉제(= `bodiceResult.
  necklineLengths.half`, 반패턴 합계 = 앞목 반쪽 + 뒤목 반쪽, CB 접어재단). `extensionLenCm` =
  `bodiceResult.placket.parameters.overlapCm`(여밈 없으면 0). **연장분은 seamLenCm 에 미포함.**
- **`standTopLenCm` 은 현재 "직선 스탠드 윗선 측정값"이며, C2 칼라 본체 봉제 길이는 아직 미확정이다.**
  UI 도 `스탠드 윗선(직선)` 으로 표시한다. C2 가 이 윗선 길이를 기준으로 본체를 만들되, 실제 본체
  봉제 길이는 C2 에서 정한다.
- **카라 geometry 는 `bodiceResult.hash` 에만 종속**한다(`collarDraft.sourceBodiceHash`). 소매에는
  의존하지 않으므로 `sourceSleeveHash` 에 묶지 않는다.
- **소매 완료본은 작업 순서 게이트일 뿐 카라 형상 소스가 아니다.** 카라 탭 활성 =
  `bodiceCheckpoint.latest` 존재·비스테일 **+** `sleeveCheckpoint.latest` 존재·비스테일(`isCurrentSleeveChanged`
  false)·몸판 변경 무효 아님(`invalidatedByBodice` false). 형상은 순수하게 `bodiceResult` 로만 만든다.
- **몸판 hash 변경 시**(재완료로 hash 달라짐) → 기존 카라 `standGeometry=null` 로 **숨기고**,
  `parameters.stand.standHeightCm` 은 **보존**, stale 노트(`몸판 변경됨 · 카라 다시 적용 필요(높이 보존)`)
  표시 → **명시적 재적용으로만 복구**. (`onCompleteBodice` 이 `refreshSleeve` 다음 `refreshCollarStale` 호출.)
- **좁은 화면에서는 카라를 아래 행으로 reflow**: 카라를 소매 오른쪽 GAP 10cm 로 우선 배치하되, 그
  배치로 union fit zoom 이 `COLLAR_MIN_FIT_Z`(0.32) 미만이면 body+sleeve 아래 행 가로중심으로 이동
  (실측: 1280·560px=오른쪽, 360px=아래). 카라 배치는 `working.geometry` 밖 별도 조각이라 fitUnion 이
  카라 bbox 를 union 에 포함시켜 항상 화면 안.
- **아직 없는 것**: 스탠드 베이스 곡률·CF 훅업·앞끝 형태 / **C2 칼라 본체**(스탠드 윗선 기준 생성·
  칼라 폭 기본 6cm·셔츠 칼라 끝) / C3 직접 편집 / 시접·너치·심지·단추. 전부 별도 승인 후.

### 데이터 모델·구조
- **순수 모듈 `js/designCollar.js`**(`window.designCollar`): `computeStand(bodiceResult, {standHeightCm})`
  → `{ standGeometry:{outline,construction}, seamLenCm, extensionLenCm, standTopLenCm, standHeightCm,
  anchors }`. 로컬 프레임(CB x=0, 봉제 모서리 y=0, 스탠드 −y). 세그먼트에 `part`
  (`neck-seam`/`extension`/`cf`/`top`/`cb-fold`) 태깅. 실패 계약: `no-bodice`/`no-neckline`/
  `invalid-overlap`/`invalid-stand-height`. 입력 불변. render·state·storage 미접근.
- **`working.collarDraft`**(세션 전용, reload 소멸) = `{ sourceBodiceHash, type:"shirt-two-piece",
  parameters:{stand:{standHeightCm}}, standGeometry, collarGeometry:null(C2), measure:{seamLenCm,
  extensionLenCm,standTopLenCm} }`. **`working.geometry` 밖**이라 엉덩이 길이 재계산(computeGeometry
  가 working.geometry 통째 교체)에도 **카라가 유지**된다(patternLines 와 같은 이유).
- **`js/designLayout.js`**: 카라를 4번째 배치 조각으로(`bboxOfStand`·`collarAutoOffset` 순수 헬퍼 +
  `L.collar` offset·`placement.collar`). collar geometry 는 `collarDraft.standGeometry` 에서 읽음
  (working.geometry 아님). `refreshAutoLayout` 이 소매 오른쪽/reflow 배치, `fitUnion` 이 카라 포함.
  카라는 C1 에서 **드래그 없음**(hit rect 없음, placement 항상 auto).
- **`js/render.js`**: design 분기에 `_appendCollarStand`(스탠드 outline 닫힌 path, `L.collar` transform).
  `standGeometry` 없으면(stale 숨김) 미렌더. CSS `.design-collar-stand`(스틸블루 #0E7490).
- **`js/ui.js`**: 카라 서브탭 게이트(`collarGateOk`/`syncCollarSubtabGate`), 생성/재파생(`deriveCollar`),
  stale 숨김(`collarStale`/`refreshCollarStale`), 패널(높이 입력·적용/초기화·측정 노트).
  `refreshCollarUI` 는 `updateSleeveCheckpointUI` 종점에서 호출(소매/몸판 변경이 게이트에 영향).

### 검증
- 하네스: **designCollarCheck 32**(봉제/연장 분리·폐곡선·여밈 없음 4세그·실패·입력 불변) +
  **designLayoutCheck 22→29**(bboxOfStand·collarAutoOffset right/below·ensureLayout collar 기본).
  runAll 전체 통과, **shape/perf 골든 diff 0**, 엔진·render 라이브 원형 경로 무변경.
- 실브라우저(격리 origin `127.0.0.1:8420`, storage 0키, 콘솔 0): 원형 생성→완료→디자인→몸판 완료→
  소매 적용/완료 후 **카라 탭 활성**·적용 → 카라 스탠드 렌더(소매 오른쪽), 측정 `목둘레 봉제 18.8·여밈
  연장 1.75·스탠드 윗선(직선) 20.6cm`. 몸판 재완료(hash 435afbcb→fdc77e16) → 카라 **숨김·높이 3 보존·
  stale 노트**, 소매 재완료 후 재적용 → 새 hash·**여밈 연장 1.75 반영**. 엉덩이 길이 적용해도 카라 보존,
  초기화 시 제거, reference frozen. reflow 실측(1280/560=오른쪽, 360=아래 행, 전부 화면 안).

### C1c 스탠드 곡률 (직선+원호 복합, 어깨 경계) — 위 직선 스캐폴드를 곡선화

C1 직선 스캐폴드를 **아랫선(목둘레 봉제) 곡선화**로 확장. **standTopLenCm(직선 윗선)을 C2 봉제로 쓰면
스탠드 곡선화 시 본체가 깨지므로**, C2 전에 곡률을 먼저 확정한다(사용자 지시).

- **직선+원호 복합, 어깨 경계**: `CB ─(뒤목 직선 = necklineLengths.back)─ 어깨 ─(앞목 원호 = .front,
  CF 에서 frontRise 상승)─ CF ─(CF 접선 여밈 연장)`. **상승 시작 위치는 임의 비율이 아니라 어깨점**
  (뒤목/앞목 경계) — 전통 2피스 칼라 제도가 CB·어깨·CF 를 구분하는 것과 일치. 별도 "상승 비율" 파라미터 없음.
- **★ 수학적 원호가 아니라 "원호형 cubic"이다** — 끝점·접선은 원 위, 사이는 cubic 근사. 그래서 해석식
  `R·θ` 와 실제 봉제선 길이가 미세하게 다르다. **반환·검증 길이는 전부 실제 출력 primitive 를 adaptive
  flattening 으로 측정한 값**이다(해석식 메타값 아님) — `upperNeckSegmentLenCm` 도 `(R−H)θ` 가 아니라
  실측 윗선 primitive 길이. 정확도를 위해 앞목 원호를 **얕은 sub-cubic(≤30°) 여러 개로 분할**한다(θ 클 때
  단일 cubic 오차·법선거리 드리프트 방지). C2 는 이 실측 길이를 기준으로 삼아야 다시 흔들리지 않는다.
- **원호 계약**: 앞목 목표 길이 L=`.front`, 앞끝 올림 h=`frontRiseCm`. `L=R·θ, h=R(1−cosθ)` → θ 수치 결정,
  R=L/θ. 원호 시작 접선=뒤쪽 직선과 수평(접선 연속), CF 높이=frontRise, 여밈=CF 접선 방향(사용자 확정).
- **윗선 = 법선 오프셋(standHeight)**: 직선부 평행(길이=뒤목), 원호부 **동심(반경 R−H)** → 윗선 앞목 구간이
  아랫선보다 짧아짐(곡선 스탠드 정상 성질). frontRise 는 CF 를 CB 대비 올리는 값(여밈 연장은 그 뒤 별도).
- **`frontRiseCm=0` → C1 직선 스캐폴드 정확 재현**(단일 목둘레 봉제선, 4/5세그). 기본값 frontRise=1.5·
  standHeight 3. UI 입력 범위 0–6(과대 방지).
- **5분리 반환**: `lowerNeckSeamLenCm`(=half, 실측) / `lowerExtensionLenCm` / `upperNeckSegmentLenCm`(<lower,
  실측) / `upperExtensionLenCm` / `upperTotalLenCm`. **C2 는 `upperTotalLenCm` 을 직접 쓰지 않는다** —
  실제 셔츠 칼라는 스탠드 앞끝보다 약간 뒤(≈3mm 물림)에서 본체가 끝나므로, 그 **앞끝 여백은 C2 의 별도
  파라미터**로 확정한다(C1c 에서 잠그지 않음).
- **원자적 실패(이전 유지)**: `invalid-front-rise`(θ∈(0,π) 해 없음, rise≥2·front/π) / `invalid-stand-offset`
  (R−H≤0, 윗선 동심 오프셋 붕괴) / `self-intersection` / 비유한.
- **변경**: `js/designCollar.js`(곡률 복합·adaptive 측정·sub-cubic) · `js/designLayout.js`(`pointsOfPrim` 에
  cubic bbox 추가) · `js/ui.js`(앞끝 올림 입력·5분리 노트·실패 사유) · `index.html`(입력·캐시). **render.js·
  css·shape/perf 골든 무변경.**
- **검증**: designCollarCheck **35→44**(직선+원호·frontRise0 재현·어깨경계·접선 연속·**실제 primitive 측정
  잠금**: 반환==실측, 뒤직선+앞cubic 실측 vs half ≤1e-3, upper==실측 primitive, 원호 전 지점 법선거리 vs
  standHeight ≤1e-2, 여밈 primitive 일치). 실측 여유 압도적(`|lower−half|≈2e-7`, `법선오차≈1.6e-7`; θ 큰
  경우 sub-cubic 3분할도 동일). runAll 전체 통과, 골든 diff 0. 실브라우저(격리 origin, storage 0, 콘솔 0):
  곡선 밴드 렌더(앞끝 상승), 반환 `lowerNeckSeam 18.8218 == 실제 primitive == half`·`upperNeck 18.0081 ==
  실측`, frontRise=0 직선 재현, 입력 범위 가드, reference frozen. 커밋 `a6bd352`(코드).

### C2 칼라 본체 첫 스캐폴드 (2피스 셔츠 칼라 본체)

C1c 스탠드 윗선 위에 붙는 **칼라 본체**를 만든다. `working.collarDraft.body = { parameters, geometry,
attachLenCm }`(세션 전용). 순수 `designCollar.computeBody(standResult, params)` + 스탠드가 노출하는
`upperNeckPath`(cbTop→CFu, **여밈 연장 제외** 윗선 목 primitive). 커밋 `2de4766`(코드).

- **★ 부착선 = 스탠드 윗선 목 primitive 를 CF→CB 방향으로 `frontInsetCm` 만큼 물린 subpath**.
  `attachLen = upperNeckSegmentLenCm − frontInsetCm`. **`upperExtensionLenCm`(여밈 연장)은 절대 더하지
  않는다** — 실제 셔츠 칼라도 스탠드는 버튼 연장까지 가지만 본체는 CF 보다 약간(기본 0.3cm) 뒤에서 끝난다.
- **물림 0.3cm 는 x 좌표가 아니라 실제 윗선 호길이 기준**이다. cubic 중간에서 끝나면 **de Casteljau 로
  정확 분할**(t 는 호길이 이분탐색). **`attachLenCm` 은 해석식이 아니라 실제 출력 primitive 측정값**
  (실측 물림 오차 ~1e-13).
- **★ 용어**: `frontProjectionCm`(기본 4cm)는 **접선 방향 투영량**(칼라 앞끝을 CF 접선 전방으로 돌출시키는
  양)이다. **실제 포인트 사선 길이가 아니다**(그건 앞폭 6 + 투영 4 가 합쳐져 더 길다). UI 라벨 "칼라 앞끝
  돌출", 내부명 `frontProjectionCm`. **"칼라 끝 길이"로 부르지 않는다.** 회귀로 잠금:
  `dot(tip−frontOuter, frontTangent)=frontProjection`, `dot(tip−frontOuter, frontNormal)=0`
  (anchors 에 `frontTangent`/`frontNormal` 노출).
- **첫 스캐폴드 형상(사용자 확정)**: 부착선(CB→물림) + CB 에서 부착선 법선 6cm(`cbWidthCm`) → CB outer +
  단순 직선 외곽(CB outer→front outer) + 앞쪽 외곽점에서 접선 전방 4cm 돌출 → tip + tip→물림점 연결(셔츠
  칼라 포인트). **`cbWidthCm=6` 을 앞쪽에도 동일 적용한 평행 폭 스캐폴드**(front outer = 물림점 + 6cm 법선).
- **아직 미구현(경계)**: 앞쪽 폭 변화 · 외곽 곡률 · 칼라 벌어짐(spread) · 실제 포인트 사선 길이 조절 —
  전부 후속 증분(별도 사양). C2 는 부착 길이·CB 폭·물림·앞끝 투영만.
- **실패(원자적, 이전 유지)**: `invalid-stand`/`invalid-cb-width`/`invalid-front-inset`(음수·≥윗선 길이)/
  `invalid-front-projection`/`self-intersection`.
- **수명주기**: 스탠드 적용(비스테일)일 때만 본체 활성. **스탠드 높이·앞끝 올림이 바뀌면**(deriveCollar 가
  collarDraft 재생성) **본체 자동 소멸 → 명시적 재생성**. 몸판 hash 변경 stale 시 스탠드·본체 함께 숨김.
- **변경**: `designCollar.js`(computeBody·upperNeckPath) · `ui.js`(본체 컨트롤·stale) · `render.js`
  (`_appendCollarBody`, 파란 #2563EB) · `designLayout.js`(collar bbox = 스탠드∪본체, `pointsOfPrim` cubic) ·
  `css`·`index.html`. shape/perf 골든 무변경.
- **검증**: designCollarCheck **44→65**(부착선=윗선−물림·연장 미포함·CB 폭·물림 호길이·de Casteljau
  분할·실측 attachLen·앞끝 투영 접선성분 4/법선성분 0·실패·불변). runAll 전체 통과, 골든 diff 0. 실브라우저
  (격리 origin, storage 0, 콘솔 0): 본체 렌더(스탠드 위 파란 조각·앞 포인트), `attachLen 17.7081 = 윗선 목
  18.0081 − 0.3`, 스탠드 재적용 시 본체 stale·재생성, 초기화, **360px 본체 포함 fit(스탠드∪본체 union)·
  클리핑 0**(좁은 화면 아래 행 reflow).

### C2 앞쪽 폭 변화 (frontWidthCm) — CB 폭과 독립

칼라 본체의 **앞쪽 폭을 CB 폭과 독립**으로 조절해 포인트의 깊이·기울기를 바꾼다(외곽선은 이 증분까지
직선 유지). 커밋 `44b193d`(코드). **spread(벌어짐)를 별도 입력으로 넣지 않는다** — 현재 `CB 폭 + 앞끝
돌출` 과 자유도가 겹쳐 과결정이고, 실제 벌어짐·롤은 원단·심지 영향까지 받아 2D 종이 패턴의 단일 수치로
단정하기 어렵다(FreeSewing/Minerva 제도 원리 참고). 대신 2D 에서 명확히 검증 가능한 앞쪽 폭부터 추가.

- **최종 파라미터**: `{ cbWidthCm:6, frontWidthCm:6, frontInsetCm:0.3, frontProjectionCm:4 }`. **기본 6/6/0.3/4
  는 현재 geometry 와 정확히 동일**(frontWidth 생략 시 cbWidth 로 폴백 → byte-identical, 하네스로 잠금).
- **`front outer = 앞 부착점(target) + frontWidthCm·법선`**(CB outer 는 그대로 `cbWidthCm·법선`). tip 은
  여전히 `front outer + frontProjectionCm·접선`. 앞폭을 줄이면 포인트가 짧고 얕아진다(√(frontW²+proj²)).
- **읽기 전용 measure(UI 표시)**: CB 칼라 폭 · 앞쪽 칼라 폭 · 앞끝 접선 돌출 · **포인트 사선 길이
  `= dist(tip, attachFront) = √(frontWidth²+projection²)`**(앞폭·투영 합성이라 투영보다 길다) ·
  **앞끝 기울기 `= atan2(frontWidthCm, frontProjectionCm)`**.
- **★ 앞끝 기울기는 부착선 로컬 접선 기준 평면 기하값**이다 — **캔버스 전역축도, 착용 시 spread 도 아니다.**
  포인트 대각(target→tip)을 접선/법선으로 분해하면 접선성분=projection, 법선성분=frontWidth 이고
  `localTiltDeg = atan2(frontWidth, projection)`. 따라서 **frontRise 가 바뀌어도 같은 본체 비율이면 값이
  동일**하다(회귀로 고정: `localTangentComponent===frontProjectionCm`, `localNormalComponent===frontWidthCm`,
  `localAngle===atan2(frontWidthCm, frontProjectionCm)`, frontRise 1.5 vs 2.5 동일). 초기 구현은 접선을
  캔버스축으로 잰 값(15.1°)이라 frontRise 종속이었고 이를 교정했다.
- **실패**: `invalid-front-width`(0·음수). 폐곡선·자기교차 검사 유지.
- **변경**: `designCollar.js`(frontWidth·measure) · `ui.js`(입력·읽기전용 표시) · `index.html`(입력·캐시). shape/perf 골든 무변경.
- **검증**: designCollarCheck **65→79**(앞폭 독립·기본 6/6 byte-identical·포인트 사선 √52/√25·로컬 접선
  성분=proj/frontWidth·localTilt=atan2(frontWidth,proj)·frontRise 무관·실패·폐곡선). runAll 전체 통과, 골든
  diff 0. 실브라우저(격리 origin, storage 0, 콘솔 0): 기본 56.31°·앞폭3 → 36.87°(=atan2(3,4))·frontRise
  2.5 재적용해도 56.31° 동일.
- **다음 순서**: 외곽 곡률 → 관리형 선 직접 편집 → 카라 완료 스냅샷.

### C2 외곽 곡률 (outerBowCm) — cm 단위 signed 휨량

칼라 본체의 **외곽선(top edge)만** 매끄럽게 휜다(벌어짐·포인트 위치는 이 증분에서 안 바꾼다). 커밋
`ce87ffd`(코드). **추상적인 0–1 곡률이 아니라 종이 위에서 잴 수 있는 cm 단위**로 정의한다.

- **★ `outerBowCm` 정의**: 일반적인 "곡률 반경"이 **아니라**, **직선 외곽(cbOuter↔frontOuter)의 중점에서
  부착선 반대 방향 법선으로 측정한 signed 휨량(cm)**이다. `0`=직선, 양수=바깥 볼록(부착선에서 멀어짐),
  음수=안쪽 오목(부착선 쪽). UI 범위 −2…2 step 0.1, 기본 0.
- **`outerBowCm===0` 은 두 path 를 만들지 않고 현재 line primitive 를 그대로 반환** → byte-identical no-op
  (outerBow 생략과도 동일). 파라미터 없는 기존 body 호출도 bow=0 폴백이라 형상 불변.
- **고정점(불변)**: `cbOuter`·`frontOuter`·`tip`·부착선 전체·CB 폭·앞쪽 폭·앞끝 돌출. bow 는 **외곽선만** 바꾼다.
- **외곽선 = `cbOuter → bowMid → frontOuter` 두 cubic**: `bowMid = 직선 중점 + signed 법선 × outerBowCm`.
  **CB 시작 접선 = 부착 CB 접선**(=CB 접힘선과 직각), **중간점 두 cubic 접선 연속(G1)**, **frontOuter 도착
  접선 = 앞끝 돌출(tTgt) 방향**(frontOuter→tip 매끄럽게 연결). **핸들 = 각 구간 길이의 1/3**(overshoot 방지).
- **`measure.outerEdgeLenCm` = 실제 출력 primitive 를 adaptive flattening 으로 측정한 값**(해석식 아님).
  `measure.outerBowCm` 도 함께 반환. UI 는 이 둘을 읽기 전용 표시.
- **★ `FLAT_TOL` 1e-4→1e-5 는 길이 측정 정밀도 변경일 뿐 형상 좌표 변경이 아니다** — 반환 길이(outer·attach·
  arc)가 독립 dense 측정과 <1e-5 일치하도록 정밀화한 것이고, geometry 좌표·byte-identical no-op 은 불변.
- **원자적 실패(이전 유지)**: `invalid-outer-bow`(비유한) · `self-intersection`(과도한 휨이 부착선·포인트선과
  교차). ± 양쪽 폐곡선·자기교차 0 확인.
- **변경**: `designCollar.js`(outerBow·measure·FLAT_TOL) · `ui.js`(입력·읽기전용 표시) · `index.html`(입력·캐시). shape/perf 골든 무변경.
- **검증**: designCollarCheck **79→109**(bow 0 byte-identical·단일 line·고정점/부착선/폭·투영/포인트 불변·
  중점 signed offset=outerBowCm·3접선 연속(CB=부착접선/중간/front=돌출)·outerEdgeLen 실측 일치·±폐곡선·
  비유한/과도 휨 실패). runAll 전체 통과, 골든 diff 0. 실브라우저(격리 origin, storage 0, 콘솔 0): bow 0
  단일 line, +1.5 바깥 볼록(외곽선 16.1→16.5), −1.5 안쪽 오목, 읽기전용 measure 표시.
- **다음(관리형 직접 편집)**: 현재 파라미터 형상을 source 로 변환하되 **부착선 endpoint·CB 접힘 endpoint 는
  보호**하고 **외곽·포인트 anchor/handle 만 편집**하는 구조. 그다음 카라 완료 스냅샷.

### C3 칼라 본체 직접 편집 (관리형 선, 소매산 manual 미러)

파라미터 본체를 **관리형 patternLine 으로 변환**해 직접 편집한다. 소매산 manual(managedBy sleeve-cap)과
같은 결이되, **소매산 인프라(designLineTool 편집·보호·snap)를 재사용**한다. 커밋 `1ef42d6`(코드).

- **고정 anchor topology**: 관리형 체인은 항상 `[cbOuter, bowMid, frontOuter, tip, attachFront]` (5 anchor·
  4 세그). `outerBowCm=0`(직선)도 변환 시 **중간점 bowMid 를 명시 생성**해 두 line 으로 정규화 → 편집
  anchor index 가 파라미터 상태와 무관하게 동일. 곡선 외곽은 기존 두 cubic 유지.
- **★ 관리형 선이 source of truth**: `computeFromBodyLine(managedSegs, locked)` 가 편집된 체인 +
  **고정 부착선**으로 본체를 재조립한다. **params 로 외곽·포인트를 다시 계산하지 않는다**(params 는 복귀용
  보존). `locked = {attachSegs(고정 부착선), attachCB, attachFront, cbOuter}` — 첫 anchor=cbOuter·마지막
  anchor=attachFront 정확 일치를 강제(endpoint 이동 시 무효).
- **허용 접점 한정(blanket tolerance 금지)**: 폐곡선 outline(부착 + 역managed + cb-fold)의 proper-crossing
  검사(`outlineSelfIntersects`)만 쓴다 — cb-fold↔체인은 cbOuter, 부착선↔체인은 attachFront 에서만 접하고
  (인접 세그 공유 endpoint 라 자동 허용), 그 외 횡단·침범은 전부 무효. + 퇴화 면적 차단.
- **소매 stale ≠ 카라 invalidation 분리**: 소매 변경/stale 은 **카라 탭 게이트만** 잠그고(collarGateOk)
  collarDraft·관리선을 **삭제하지 않는다**. **몸판 hash 변경**만 `refreshCollarStale` 이 **관리선 제거·manual
  폐기·스탠드/본체 숨김**.
- **수명주기(소매산 미러)**: `onCollarBodyManual`(변환: `collarBodyLineFromGeometry` → managedBy collar-body
  선 push, mode=manual, manualLocked 저장) · `recomposeCollarBody`(designLineTool pointerup 훅: 검증→
  geometry/measure 갱신 / 무효면 `body.invalid`·마지막 유효 geometry 유지) · `onCollarBodyRevert`(관리선만
  제거·다른 선 보존·보존 params 로 parametric 재파생). manual 중 **스탠드+본체 파라미터 입력·적용 전부
  잠금**(부착선이 스탠드에 고정되므로).
- **designLineTool 통합**: `isCollarBodyLine`(managedBy collar-body) 보호 — 역할 변경·개별 Delete 금지,
  endpoint(index 0·last) 이동 금지, 편집 pointerup 이 `window.recomposeCollarBody` 호출. snap 은 piece
  기반이라 자연히 **자기 anchor + 0.5cm 격자만**(geom["collar"] 없음), 핸들 위치 snap 없음·Shift 45°.
- **render**: 카라 레이어(L.collar offset)에 관리선/overlay. **유효 시 파란 body geometry 만(중복 렌더 없음)**,
  무효 시 빨강 점선(`.design-collar-invalid`, 카라는 `.design-working` 밖이라 전용 클래스). **collar hit rect
  는 manual 편집 시에만** 추가 → `pieceAt` 이 "collar" 해석(designLayout 은 collar 를 PIECES 에서 제외해
  레이아웃 드래그 무시 = 편집 전용).
- **변경**: `designCollar.js`(collarBodyLineFromGeometry·computeFromBodyLine) · `designLineTool.js`(보호·훅) ·
  `render.js`(collar-body 분기·overlay·hit rect) · `ui.js`(수명주기·모드잠금·stale) · `css`·`index.html`.
  엔진·shape/perf 골든 무변경.
- **검증**: designCollarCheck **109→125**(고정 topology·round-trip·endpoint 잠금·교차·불변) · designLineToolCheck
  103 유지. runAll 전체 통과, 골든 diff 0. **실브라우저(격리 origin, storage 0, 콘솔 0)**: 변환(관리선·파라미터
  잠금·hit rect·유효 시 navy만) · **실제 pointer 선택**(pieceAt="collar"·overlay 5 anchor) · 역할변경/삭제 차단 ·
  유효 편집 재합성 · 무효 편집(self-intersection·빨강 점선·마지막 유효 navy 유지·사유) · 복구 · 복귀(관리선 제거·
  파라미터 해제) · **몸판 hash 변경 관리선 제거·collar 숨김**.
- **다음**: `collarResult` 완료 스냅샷(sourceBodiceHash 고정, 시접·너치·심지 제외).

### ✅ 카라 모양 완료 체크포인트 (collarCheckpoint) — Design 형상 단계 종료

카라 결과를 **세션 스냅샷 `working.collarResult` 로 잠근다**(bodice/sleeve 체크포인트와 같은 결). 커밋
`9980d4a`(코드). **아직 시접·너치·심지·윗칼라/밑칼라 차이·재단 아님.**

- **★ 형상 종속성 vs 작업 순서 게이트 분리(핵심)**: 형상 source = `bodiceResult`(`sourceBodiceHash` 고정) —
  **몸판 hash 변경 → 카라 무효**(`invalidatedByBodice`). **소매 완료본은 작업 순서 게이트일 뿐 스냅샷 source 에
  미포함** — 소매 변경은 카라 result·geometry 를 **무효화하지 않고** `카라 완료됨 · 소매 단계 변경됨 · 작업
  순서 확인 필요`만 표시(`sleeveStepChanged`).
- **완료 게이트(모두 통과)**: bodiceResult 존재·비스테일 / `collarDraft.sourceBodiceHash === bodice.hash` /
  현재 sleeveResult 존재·비스테일(순서 게이트) / 스탠드·본체 geometry 존재·폐곡선·자기교차 없음
  (`designCollar.validateClosedOutline`) / body manual 이면 관리선 존재·`invalid===false` / 부착선=스탠드 윗선
  subpath(`attachLen = upperNeckSegment − frontInset`, **여밈 연장 미포함**) / 실측·파라미터 유한. 실패 시 기존
  collarResult·현재 geometry 불변.
- **스냅샷**(deep clone + deep-freeze): `{schemaVersion:1, type:"shirt-two-piece", sourceBodiceHash, sourceBlock,
  necklineLengths, stand:{parameters,geometry,lengths:{lowerNeckSeam,lowerExtension,upperNeckSegment,upperExtension,
  upperTotal}}, body:{mode, parameters, geometry, attachLenCm, measures, manualSource:null|{lineId,segments}},
  symmetry:"half-cb-fold", hash, completedAt}`. `manualSource` = 관리형 `collar-body` 선 하나만.
- **`hash` = 형상 전용**: `completedAt`·layout·선택·snap·UI note·다른 patternLines 제외. `isCurrentCollarChanged`
  는 **형상 signature 만 비교(소매 게이트와 무관)** — 소매 stale 은 카라 형상을 안 바꾸므로 "변경"으로 보지
  않는다(그 상태는 sleeveStepChanged 로 표시).
- **idempotent 완료**: 같은 현재 형상에서 `카라 완료` 반복 → 기존 `collarResult` **참조 그대로 반환·`completedAt`
  불변**. 이전 frozen result 는 자동 삭제·갱신하지 않고, 명시적 완료에서만 교체.
- **변경/무효화**: 스탠드·본체 파라미터 변경 또는 manual 편집 → `카라 변경됨` / 몸판 hash 변경 → `몸판 변경으로
  카라 무효` / 소매 변경 → `소매 단계 변경됨`(무효화 아님). refreshCollarStale(몸판 hash)은 관리선·스탠드·본체를
  제거하지만 **collarResult 는 남긴다**(무효 상태 표시).
- **UI**: 요약(`스탠드: 목 봉제·연장·윗선 / 본체: 부착·CB폭·앞폭·포인트 사선·외곽`) + 상태(완료/변경됨/몸판 무효/
  소매 단계 변경됨) + `카라 모양 완료` 버튼(게이트 통과 시만 활성).
- **변경**: `designCollar.js`(`validateClosedOutline`) · `collarCheckpoint.js`(신규) · `ui.js`(완료 UI) ·
  `index.html`(UI·script·캐시). 엔진·render·shape/perf 골든 무변경.
- **검증**: collarCheckpointCheck **27**(게이트 실패·불변 스냅샷·deepFrozen·형상전용 스테일·몸판 무효 vs 소매 순서
  분리·idempotent·manual manualSource, 실제 designCollar 로드). runAll 전체 통과, 골든 diff 0. 실브라우저(격리
  origin, storage 0, 콘솔 0): parametric·manual 완료(manualSource segs 4)·idempotent(참조·completedAt 불변)·
  param 변경→변경됨·재완료·**소매 변경→소매 단계 변경됨(result 유지)**·**몸판 hash 변경→몸판 무효(result 유지)**·
  요약 표시.

**★ Design 형상 단계(몸판→소매→카라) 전체 완료.** 다음은 별도 통합 결과를 만든 뒤 파트명·수량·식서·시접·너치
(재단 단계)로 넘어간다 — 별도 사양·승인 후.
## ✅ 교재 M형 셔츠 칼라 표준 기본형 (2026-08) — 몸판 셔츠 목선 + 칼라 M 프리셋

교재(『パターン製作の基礎』)의 **M형 셔츠 칼라 제도법을 "표준 기본형"으로 추가**했다. 기존 칼라 시스템(수치 변형·
관리형 직접 편집·완료 체크포인트)은 **전부 그대로 보존** — 기본값과 프리셋만 M 기준으로 정렬한 것이다. 두 증분:

### ★ 몸판 셔츠 목선 여유와 칼라 M 기본형은 서로 다른 명시적 작업이다
- **증분 A(몸판 셔츠 목선)**: 몸판 네크라인 단계의 프리셋. 앞·뒤 어깨목점 +1cm, 앞중심 목점 1cm 내림
  (`neckWidthCm=1, frontDepthCm=1, backDepthCm=0`). 밴드 달림선 길이 기준 `× = 뒤목둘레`, `⊘ = 앞목둘레`,
  밴드 = `× + ⊘`(= `necklineLengths.half`). **적용하면 몸판이 변경 상태**가 되고 사용자가 몸판을 다시 완료해야
  하며, 칼라는 새 bodiceResult 만 참조한다(collar 모듈이 bodiceResult 를 묵시 변경하지 않는다).
- **증분 B(칼라 M 기본형)**: 카라 단계의 프리셋. 밴드 3·앞끝올림 1·CB폭 4·물림 0.5·돌출 1.5·사선 6·외곽휨 0.
- 둘은 **별개 프리셋**이다 — 셔츠 목선(몸판)은 네크라인 카드 `셔츠 목선`, 칼라 M(카라)은 `교재 M 기본형으로
  초기화` 버튼. 셔츠 목선 프리셋은 **placket 값을 변경하지 않는다**(앞여밈은 기존 몸판 여밈 설정 사용).

### 셔츠 목선 타입(`shirt`) — round scoop 명시적 재사용
- `designBodice.js` `NECK_TYPES` 에 `shirt` 추가. `buildNecklineShape` 는 **`type==="round" || type==="shirt"` 를
  명시적으로** 처리해 round 사분타원 scoop 을 재사용한다(우연한 fallthrough 아님). **알 수 없는 type 은 조용히
  round 가 되지 않고** `unknown-neckline-type` 로 실패한다(NECK_TYPES 게이트와 이 분기가 어긋나면 loud fail).
  computeGeometry 상 NECK_TYPES 에 없는 type 은 미적용 no-op(=original)이라 이미 round 와 다르다.
- **셔츠 카드 클릭은 M 여유값(1/1/0/1)을 입력에 채우기만** 하고, 실제 몸판 변경은 기존 `적용` 버튼에서만 일어난다
  (카드 클릭 시점 geometry 불변 — 실측 확인).

### ~~3cm 작업 간격은 geometry/hash 에 없다 · CB 길이 조정의 계산적 동등~~ → 폐기(M-v2, 아래)
> 이 섹션의 옛 설명(위 칼라 부착선 = 밴드 윗선 subpath 복사, gap 3 생략, "처음부터 길이차 0 = CB 이동 동등")은
> **교재 제도법과 달랐다.** 아래 "✅ 교재 M형 위 칼라 제도 교정(M-v2)" 섹션이 현재 계약이다.

### M 초기화 ≠ manual "수치형으로 돌아가기" (서로 다른 동작)
- **`교재 M 기본형으로 초기화`**(`onCollarBaseM`): 스탠드·본체를 **교재 M 기준값으로 정확히** 복원한다
  (referenceParams/referenceBodyParams — M-v2: gap 3·CB 폭 4·setback 0.5·수평 돌출 1.5·실제 사선 6, √33.75 는 파생).
- **`수치형으로 돌아가기`**(`btnCollarBodyRevert`, 라벨 정정): 관리형 직접 편집(manual) 진입 **전 보존된 사용자
  파라미터로 복귀**한다(M 기준값이 아니다). 둘은 명시적으로 다른 버튼·동작.
- **manual 보호**: 관리형 직접 편집 중에는 `교재 M 기본형` 버튼이 **disabled**(수치형으로 먼저 돌아가야 함).
  버튼 상태는 `syncCollarBodyModeUI` 한 곳에서 **양방향 단일 관리**(manual 진입 disable / 수치형 복귀 re-enable,
  조건 = gate 통과 + manual 아님). 핸들러(`onCollarBaseM`)도 manual 이면 즉시 return 해 **관리선을 묵시 삭제/
  덮어쓰기 하지 않는다**(실측: manual 중 강제 클릭에도 collarDraft·관리선·다른 사용자 patternLines 전부 보존).
- **M 초기화 원자성**: 스탠드·본체를 **임시로 모두 계산·검증**한 뒤 둘 다 성공할 때만 `collarDraft` 를 **한 번에
  교체**한다. 어느 하나라도 실패하면 기존 스탠드·본체·관리선·완료본을 전부 그대로 유지(실측: computeBody 실패
  stub 에서 collarDraft 완전 보존).

### 완료본 상태 전이 · baseMethod
- M 초기화로 실제 geometry 가 바뀌면 기존 `collarResult`·`designResult` 가 각각 `카라 변경됨`·`Design 변경됨`
  으로 표시된다(실측: 완료 후 M 초기화 → 둘 다 isChanged=true).
- **`baseMethod: "bunka-shirt-collar-M-v1"`** 를 collarDraft·frozen collarResult **메타로 기록**하되 **형상 hash 에는
  제외**한다(모든 카라가 M 제도법 파생이므로 baseMethod 는 type 과 함께 출처 표기용). baseMethod 만 바꾸고
  geometry 가 동일하면 hash 불변(실측: isCurrentCollarChanged=false).

### 변경 파일·검증
- **엔진 로직 무변경** — geometry 엔진(computeStand/computeBody)은 이미 M 제도법 그대로였다. 증분 B 는 기본값 6곳
  교정(frontRise 1.5→1, cbWidth 6→4, frontInset 0.3→0.5, frontProjection 4→1.5, frontWidth 6→√33.75) + baseMethod +
  프리셋 UI + 테스트/문서일 뿐이다.
- 변경: `js/designBodice.js`(shirt 타입) · `js/designCollar.js`(M 기본값) · `js/ui.js`(셔츠 프리셋·onCollarBaseM
  원자성·manual 보호) · `js/collarCheckpoint.js`(baseMethod 메타) · `index.html`(카드·M 버튼·라벨·캐시 `?v=2026082810`) ·
  `test/harness/designBodiceCheck.js`(4h) · `test/harness/designCollarCheck.js`(test 12).
- 하네스: **designBodiceCheck 187 / designCollarCheck 136** PASS, runAll 전체 통과, **shape·perf 골든 diff 0**.
- 실브라우저(격리 origin `127.0.0.1:8420`, storage 0, 콘솔 0): 셔츠 카드 1/1/0/1 채움·적용전 geometry 불변·적용 후
  밴드=×+⊘ / 사용자 수치형→M 초기화 정확·M 2회 byte-identical / manual→M버튼 disabled·관리선/사용자선 보존·
  수치형 복귀 후 재활성 / computeBody 실패→collarDraft 완전 보존 / 카라·Design 완료 후 M 초기화→두 완료본 변경 /
  baseMethod hash 미포함.
## ✅ 교재 M형 위 칼라 제도 교정(M-v2, 2026-09) — 위 섹션의 "subpath 복사·gap 생략" 설명 대체

**사용자 확정 제도 순서(reference recipe, `designCollar.computeBody`)** — named semantic point:
1. 밴드: 몸판 뒤목→옆목→앞목 목둘레로 아래선, CF 끝 1cm 올림, 폭 3(기존 `computeStand` 그대로).
2. `bandTopCf` = CF 1cm 올림점에서 **밴드 아래선에 90° 윗방향**으로 세운 선과 밴드 위선의 교점(`CFu`). 플래킷
   연장 끝이 아니다.
3. `setbackPoint`(위칼라 이음선 앞끝) = `bandTopCf` 에서 **밴드 위선을 따라 CB 방향 호길이 0.5**. 이세·중첩·수직
   간격 아님. `bandAttachLenCm` = 밴드 위선 CB→setbackPoint(= upperNeckSegment − 0.5, 연장 미포함).
4. `upperCbSeam` = 밴드 위선 CB 에서 CB 선(수직) 위로 **gap 3**. gap 높이 고정.
5. 위칼라 이음선 = `upperCbSeam`→`setbackPoint` **독립 cubic**(밴드 복사 아님). 곡률은 `UPPER_SEAM_RULE`
   (CB 수평 출발 · 현 방향 도착 · 핸들 = 현 길이 × 1/3, 이 파일 외곽 휨과 같은 관례) — 새 도메인 치수 없음.
6. CB 보정: 이음선 길이 = `bandAttachLenCm` 가 되도록 `upperCbSeam` 을 **수평으로만** 이동(이분 탐색).
   `cbCorrectionCm` = 보정 CB x − 밴드 CB x(+ = 앞쪽). 참조 치수에서 +0.0966cm.
7. `cbOuter` = `upperCbSeam` 에서 CB 선 위로 4.
8. `tip`: `setbackPoint` 에 CB 선과 평행한 수직 기준선 → 수평 앞쪽 1.5, 실제 사선 |tip−setbackPoint| = 6.
   수직 성분 √33.75 는 **파생 measure(`frontWidthCm`)** 일 뿐 입력/default 가 아니다.
9. 외곽선 `tip`→`cbOuter`. `outerBowCm` 은 외곽선 추가 휨만(0 = 직선, 이음선과 무관).

- **파라미터**: `{ gapCm, cbWidthCm, frontInsetCm(=setback), frontProjectionCm, pointDiagonalCm, outerBowCm }`.
  `frontWidthCm` 입력 폐기. UI 의 기존 입력 `inpCollarBodyFrontWidth` 는 라벨 "칼라 끝 사선 길이"로 사선에 매핑
  (gap 입력 없음 → 커밋값 또는 M 기준 3 유지). baseMethod `bunka-shirt-collar-M-v2`(hash 미포함 메타).
- **관리형 직접 편집 topology**: `[cbOuter, bowMid, tip, attachFront]`(3세그·4 anchor, 옛 frontOuter 제거).
  locked = 독립 위칼라 이음선. endpoint 잠금·교차 검사·원자성·manual 보호·revert 계약 그대로.
- **collarCheckpoint 게이트**: `gap-missing`(gapCm 기록 필수) · `seam-length-mismatch`(위칼라 이음선 길이 vs
  upperNeckSegment − frontInset, ≤0.01) · `extension-included` 유지. 옛 `attach-mismatch` 폐기.
- **검증**: designCollarCheck 123 · collarCheckpointCheck 29, runAll 전체 통과, shape/perf 골든 diff 0.
  실브라우저: M 적용·수치 적용(사선 7 → 실측 7)·완료·manual 중 M 차단·revert·computeBody 실패 stub 원자성.
- **의도된 변화**: 칼라 본체 geometry → collarResult·designResult hash. bodice/sleeve·dartMove 골든 무변경.

**남은 것/경계**: 기존 카라 시스템 전부 보존. 앞끝 기울기(부착 접선 기준 atan2(frontWidth, projection)=75.5°)는
M 값(사선 6·돌출 1.5)의 결과값이지 별도 파라미터가 아니다. 시접·너치·심지·윗칼라/밑칼라 차이·재단은 여전히 미포함.
