# 현재 상태 · 다음 작업 (세션 시작할 때 읽는 문서)

> **CLAUDE.md 가 "무엇을 지켜야 하는가"라면 이 문서는 "지금 어디이고 다음이 무엇인가"다.**
> 작업이 끝날 때마다 여기를 갱신한다 — 완료 상세는 `docs/history/` 로 보내고 여기엔 **현재와 다음만** 둔다.

*마지막 갱신: 2026-10-10 (소매 Ⓕ 턱 소매 P.43 구현·연결 — 미커밋 · 소매 Ⓔ 플레어 절개 3개 구현·연결 · 직전 2026-10-09 소매 Ⓓ 플레어 구현·연결 · Design 원형 소매 비교 레이어 기본 숨김 + 소매 탭 «원형 소매 비교» 토글(표시 전용, `chkSleeveRef`) · 소매 Ⓒ 마무리 — 소맷부리 곡선·맞댐선·연장 영역 · 직전 2026-10-08 새 공정 재구현·연결 — Codex 검증 대기 · 소매산 처리 최신 확정 반영 · 읽기 전용 재해석 기록 — 배포 구현은 재구현 대상 · 직전: 2026-10-07 소매 Ⓒ UI·프리셋·체크포인트·Design 통합 연결 · 직전: 2026-10-06 TEMP 몸판 곡선 기본값 · 소매 Ⓑ 연결)*

## 지금 서 있는 곳

| 단계 | 상태 |
|---|---|
| ① 원형(draft) | **완료** — 치수·다트이동·곡선 편집·`원형 완료` 세션 스냅샷(`blockWorkflow`) |
| ② Design 몸판 | **완료** — 여유량·길이·옆선·곡선화·네크라인·앞여밈·허리 다트 재배분·목표 완성 허리 + `bodiceResult` |
| ③ Design 소매 | **완료** — 하부 실루엣·위팔/소매산·직접 편집 + `sleeveResult` |
| ③ Design 소매 — 소매 Ⓐ(P.137–139, 스트레이트) | **완료·Design 통합 연결** — `designSleeveA` 엔진 + `sleevePresets`(`bunka-sleeve-A`) + `sleeveAApply`. 소매 탭 «소매 라인»에서 적용 → «소매 모양 완료» 가 `sleeveResult` 에 **`origin`(preset·method bodice-armhole·P.137) · `inputs`(소매길이) · `meta`(AH·소매산·폭·목표/실제 이세) · 불변 geometry** 를 담는다(기본 소매 전용 `parameters` 는 없음 · 공통 `cap.lengths/ease/splitPoint` 는 geometry 실측 — **재단·물리 검증의 권위값은 이 `cap.ease`**, `meta.easeTarget/easeAfter` 는 엔진 기록(샘플링 차 ~0.001cm, 맞추지 않음)). 게이트 = 기본 소매 게이트 + 차단 아님·출처 hash·현재 geometry 가 Ⓐ 재제도와 일치. 카라·`designResult` 로 그대로 이어지고 기본↔Ⓐ 전환·몸판 변경은 «변경됨/무효 → 재완료». 기본 소매 완료본은 byte-equivalent. 회귀: `sleeveAResultCheck.js` |
| ③ Design 소매 — 소매 Ⓑ(P.41, 타이트) | **완료·Design 통합 연결(2026-10-06)** — `designSleeveB`(Ⓐ 읽기 전용 → 소맷부리 W×3/4, 앞뒤 반폭 중점 절개 강체 닫힘 → 소매산 P 주변 Hermite·소맷부리 자연 Hermite 로 정리한 **한 조각 outline**; raw rigid 는 `meta.rigid` 감사용) + `sleevePresets`(`bunka-sleeve-B`, 타이트 소매 라인) + `sleeveBApply`(`working.sleeveB` · 출발 Ⓐ 는 같은 몸판·소매길이로 내부 제도 · Ⓐ/Ⓑ 배타). 소매 탭 «소매 라인»에서 적용 · 입력 = 소매길이 + 선택 손바닥 둘레(비면 W×3/4, 소맷부리 < 손바닥+3cm 는 **경고만·자동 보정 없음**). «소매 모양 완료» 가 `sleeveResult` 에 `origin`(P.41) · `inputs` · `sourceSleeveAHash` · `meta` · 불변 geometry 를 담고 카라·`designResult` 로 Ⓐ 와 같이 이어진다. **지배 ease = `cap.ease`(fairing 된 최종 geometry 실측)**, `meta.easeTarget/easeAfter` 는 감사 정보. 편차 한계 0.46 등은 **책 수치가 아닌 sweep 실측 검증 공차**([노트](book/P041.md)). 회귀: `designSleeveBCheck`(111, 1344 sweep ≈50s) · `sleeveBUICheck` · `sleeveBResultCheck`. 다음: Ⓒ UI·프리셋·체크포인트 연결(아래 행) |
| ③ Design 소매 — 소매 Ⓒ(P.41 하단, 뒤 소맷부리 다트) | **재구현·연결 + 마무리(소맷부리 곡선·앞 EL→소매구 맞댐선·연장 영역 표시) 완료(2026-10-09, Codex 검증 대기, 미커밋)** — 새 `designSleeveC`(완성 가정선 → 뒤 ◎ EL 맞댐·아래 V → 앞 ◎ → 앞 EL 절개·●◎ → 겹친 만큼 소매구 연장 → 소매산 꺾임 양쪽 ℓ2 국소 재제도 → 독립 실측) + Apply·Annotation·프리셋 문구·캐시. 회귀 `designSleeveCCheck` 64(입력 sweep 450/450) · `sleeveCUICheck` 98 · `sleeveCResultCheck` 89 · `sleeveAnnotationCheck` 278. 남은 한계: 옆선 앞−뒤 잔차(흰 도해 차, B83 0.004) · 소맷부리 곡선 실측 24.049(목표 24.050) · 앞 옆선 무릎(EL 절개 겹침, ≈2.3°) 유지 · 소매산·소맷부리 G1(곡률 연속 아님) · ℓ2 임시. **아래 «⚠…» 이하는 2026-10-08 오전까지의 이력.** 현행 해석(확정 공정·방법 교훈·대체된 가정·미확정)은 **[book/P041.md § Ⓒ 재해석](book/P041.md)**이 소유한다. 2026-10-08 최신 확정: 소매산은 Ⓐ 가 출발이고 맞댄 뒤 조금 찌그러진 것을 자연스럽게 이어 다시 그린다(Ⓐ 완전 고정 아님). 소매산 재제도 구간 ℓ=2cm — 김님 시안 평가 «좋음», **우선 유지·적용**(책 치수·최종 고정값 아님). 뒤 다리끝 = Ⓐ 밑단 교점에서 수직 아래 1cm(확정). 앞 교차·∅ 는 확정 조건으로 유일 결정됨. 뒤 EL 쐐기(■) = 김님 확정 도식(Q=뒤 절개축×EL, R=P_b→오른쪽 새 다리끝 직선×EL, D=QR, E/F=Q∓D/2 — D-259). 미확정: 재제도 구간 최종값·규칙 · 뒤 다리끝 ‘1’ 하강 의미·●의 측정 방향(뒤 ■·∅ 는 P041.md 에 조건부 유도됨). 아래는 **2026-10-07 배포 구현의 기록**(1.49 계산 겹침·최종 호 길이 1:2:1 강제·앞 바깥 전체 회전+fairing 은 대체된 가정): 엔진 `designSleeveC`(Ⓐ 읽기 전용 → 소맷부리 W×3/4, **실제 윤곽(최종 곡선) 호 길이 구간 ●:2●:● = 6.012:12.025:6.012**, EL 위 반폭 중점·EL 아래 1:2:1 경계, 앞 겹침 치수별 계산(B83 1.49), 앞 바깥 조각 절개축 위 끝 중심 강체 회전, 뒤 열린 다트(다리 길이 같음·닫힘 정합), 소매산 P_f·소맷부리 이음 G1 정리 — raw 는 `meta.rigid` 감사용) + `sleevePresets`(`bunka-sleeve-C`, 타이트 소매 라인) + `sleeveCApply`(`working.sleeveC` · 출발 Ⓐ 는 같은 몸판·소매길이로 내부 제도 · 기본/Ⓐ/Ⓑ/Ⓒ 배타). 소매 탭 «소매 라인»에서 적용 · 입력 = 소매길이 + **팔꿈치 길이 EL(cm, 기본 31.4)** — 빈 값·범위(10–60) 밖·엔진 지원 범위 오류는 이해되는 문구로 거부하고, **Ⓒ 가 켜져 있으면 차단 표시(완료 불가)로 남겨 이전 정상 형상을 현재 입력의 결과처럼 쓰지 않는다**. 표시 줄 = 소맷부리 목표/실제(호 길이)·구간 뒤:중앙:앞·EL·뒤 다트(폭·다리)·앞 겹침(계산)·AH/소매산/**이세(geometry 실측)**. «소매 모양 완료» 가 `sleeveResult` 에 `origin`(P.41) · `inputs`(소매길이·EL) · `sourceSleeveAHash` · `meta` · 불변 geometry 를 담고 카라·`designResult` 로 이어진다(**지배 ease = `cap.ease`**). 입력(EL·소매길이)·몸판 변경은 «변경됨/무효 → 재완료». 회귀: `designSleeveCCheck`(63) · `sleeveCUICheck`(97) · `sleeveCResultCheck`(89) · 기본/Ⓐ/Ⓑ 완료본 byte-equivalent. **제작 정보 표시(2026-10-07, 소매 Ⓐ/Ⓑ/Ⓒ 공통, `js/sleeveAnnotation.js` → `render.js` 오버레이 — 표시 전용·geometry/완료본/hash 불변)**: 캔버스에 패턴명·앞/뒤·SP/소매 중심·위팔(소매폭)·소매산 높이 기준선·소매길이 치수선·앞뒤 소매산 길이/AH/실제 이세(geometry 실측)를 표시하고, Ⓑ 는 소맷부리 목표 W×3/4·실측·절개축·맞댐, Ⓒ 는 EL(현재값+기본 31.4)·뒤 열린 다트 꼭짓점/두 다리 길이/폭·소맷부리 ●:2●:● 구간(최종 호 길이)·앞 겹침(계산값, 음영). 설명용은 청록 점선/가는 치수선/음영, 재단 외곽은 남색 실선(소매 라인 construction 도 청록 점선 — 닫힌 과거 절개선·겹침 영역을 재단선처럼 그리지 않음). 기본 소매는 모델 없음(기존 표시). 토글 «제작 정보 표시»(기본 켜짐, 소매 라인일 때만). 회귀 `sleeveAnnotationCheck`(276, 라벨·치수 = 독립 실측·EL/라인/몸판 변경 동기화·글자 겹침). **화면 맞춤·배치 개선(2026-10-08, 표시·뷰포트만)**: «화면 초기화» fit 이 제작 정보 영역(제목·치수·리더선)을 포함해 계산(`sleeveAnnotation.overhang` → `designLayout.withSleeveOverhang`, 토글 OFF·기본 소매는 추가 여백 0 = 기존 fit 동일), 라벨은 화면 px 기준 배치(우선순위·후보 위치 이동·리더선·번호 표시+범례 폴백, 정보는 생략하지 않음). 한계: 줌아웃이 매우 작으면 글자가 물리적으로 겹칠 수 있어 이때는 번호+범례로 모으고 확대하면 제자리 표시. 도해 대조·의도된 모서리 곡률화(별도 승인) 남음 — [노트](book/P041.md) |
| ③ Design 소매 — 소매 Ⓓ(P.42 플레어, 절개 2개) | **구현·연결 완료(2026-10-09, 커밋 `316ce4b`)** — `designSleeveD`(Ⓐ 읽기 전용 → 앞·뒤 반폭 중점 절개 2개 · 중앙 고정 · 옆 조각을 소매산 기준점 중심 강체 회전, 각 절개 ∅/2 = 소매폭×0.25 · 소매산 기준점 꺾임 국소 재제도 · 소맷부리 6 끝점 통과 곡선) + `sleeveDApply` · 프리셋 `bunka-sleeve-D` · 완료본(`sleeveCheckpoint` checkD/completeD) · 제작 정보. 회귀 `designSleeveDCheck` 38(sweep 126/126) · `sleeveDUICheck` 40. 잠정값(책 수치 아님): 벌림 거리 = 두 밑단 끝점 현 · 소매산 재제도 ℓ 2cm 시작·내부 S 면 0.25 축소(최소 1) · 소맷부리 Hermite. Ⓔ(절개 3개)는 커밋 `0abfeb4`(push 완료, Codex 재검증 관련 828 통과) — [노트](book/P042.md) |
| ③ Design 소매 — 소매 Ⓕ(P.43 턱 소매) | **구현·연결 완료(2026-10-10, 미커밋)** — `designSleeveF`(Ⓐ 읽기 전용 → 중심 ±1·±3cm 평행 절개 4개 · 가운데 띠 고정 · 소맷부리 기준점 강체 벌림, 각 턱 기본 1.5·최대 3cm · 턱 접은 상태 = Ⓐ 소매산 → 펼친 재단선은 쐐기 위 산 모양) + `sleeveFApply` · 프리셋 `bunka-sleeve-F` · 완료본(`cap.lengths` = 턱 접은 길이, `cutLengths` = 재단선, 이세 = 턱 접은 길이 − AH) · 제작 정보 · 소맷부리 = 기준점·양 끝 통과 자연 곡선(김님 승인, Ⓐ 대비 +0.0004cm 표시 — raw 강체 직선은 감사용). 회귀 `designSleeveFCheck` 63(sweep 162/162) · `sleeveFUICheck` 41. 턱 방향(김님 원문 «바깥쪽으로 접는데 소매중심이 위로 올라와야해») = 접는 선이 중심 쪽 변·중심 쪽 천이 위층. 박기 끝 미확정(만들지 않음) — [노트](book/P043.md) |
| ④ Design 카라 | **완료** — 셔츠 칼라 스탠드·본체·직접 편집·교재 M형 기본형 + `collarResult` |
| ⑤ Design 통합 | **완료** — `designResult`(세 완료본 + 절개선) |
| 처리 방법 161 | **완료** — `designFlare` + 밑단 곡선 이음 + 플레어 Ⓖ·Ⓗ 프리셋·UI(`slashSpread` = Ⓖ 위 P.163 기준점 절개) |
| 처리 방법 158 | **완료·Ⓝ 에 연결** — `designJoin.buttSpread`(맞대고 → 허리 입 점 고정 → 밑단 끝 벌림 → G1 밑단 이음). 범용 UI 는 없다(Ⓝ 경로만) |
| 처리 방법 157 | **완료·Ⓜ 에 연결** — `designJoin.buttJoin` + `designWaistSeam.split`(허리 이음선 Ⓜ). 범용 맞댐 UI 는 **만들지 않았다**(Ⓜ 라인 적용 경로만) |
| 처리 방법 163 | **Ⓞ·Ⓟ 에 연결** — 다트 없는 몸판의 WL(Ⓟ는 WL−5 이음선) 등분 수직 절개 + `buttSpread` 순차 + 이음선 fairing |
| ⑥ 재단(파트·시접·너치) | **미착수** — `designResult.hash` 에 고정할 예정. 별도 사양·승인 후 |
| ⑦ 출력(PDF·DXF) | **미착수** |

**세션 전용**: 완료본은 전부 메모리에만 있다 — **reload 하면 사라진다**(저장·복원 미구현).

## ★ TEMP 몸판+짝 소매 곡선 세트 기본값 (2026-10-06, 제거 대상 — `js/tempDefaultCurve.js`)

B83/W64/BL38 에서 **저장값이 없을 때만** 쓰는 임시 기본 곡선 **세트**. 출처 = 사용자 제공 `armhole_data_2026-07-16 (1).json` 을
JSON 불러오기 했을 때 선택되는 마지막 기록(index 24, SL52/Hem30/문화식)의 몸판 필드(anchors·handles·fArmhole·bNeckline·fNeckline) +
짝 소매(sleevePattern 9앵커·8세그먼트·offsets) — 이력은 없다. 몸판만 쓰면 공식 소매와 짝이 어긋나 총 이세가 +4.05cm 커졌다.
적용: 몸판 = B/W/BL 만 · 소매 = 추가로 SL52·Hem30·문화식 정확 일치 + 이 치수의 저장 항목 없음(아니면 기존 소매 공식).
우선순위: ① localStorage 저장값/가져온 값 → ② 이 TEMP → ③ 공식 기본값. localStorage 에 쓰지 않는다(state 메모리만).
**제거**: 파일 삭제 + `index.html` script 1줄 삭제(또는 `ENABLE_TEMP_DEFAULT_BODY_CURVE=false`).
회귀: `tempDefaultCurveCheck`(원본 JSON 이 `~/Downloads` 에 있을 때 import 동등성까지 검증).

## 몸판 라인 카탈로그 (2026-09 신설, `js/bodicePresets.js`)

[패턴학교] P.14–35 의 **라인 10 · 변형 22개(A~V)** 를 슬롯으로 잡았다. 판독은
[docs/book/P014.md](book/P014.md).

- **실행 가능**: 박시 A·B / 셰이프트 C·D / **플레어 Ⓖ**(처리 방법 161) · **Ⓗ**(P.21 — Ⓖ + 진동 기준점 수직 절개 P.163, ∅=min(●−(3+■), ■) 앞 9.590·뒤 9.915 — [노트](book/P021.md)) / **허리 이음선 Ⓜ**(P.26, 157) · **Ⓝ**(P.27, 158) · **Ⓞ**(P.28, 163) · **Ⓟ**(P.29, 163) / **프린세스 Ⓔ**(P.18 — 중심·옆 4조각, 앞 어깨 50%·0.5cm 곡선·BP 18.25° 닫음 — [노트](book/P018.md)) · **Ⓕ**(P.19 — Ⓔ + 다트 a +1·e +1.5cm · 옆선 −1.5 — [노트](book/P019.md)) / **요크 이음선 Ⓠ·Ⓡ·Ⓢ·Ⓣ·Ⓤ·Ⓥ**(P.30–35, **Ⓤ = 어깨 요크 한 장** — [노트](book/P034.md) · **Ⓥ = Ⓤ + 뒤 ∅×1 · 앞 총 ●×1.2(쐐기 + BP→밑단 수직 절개 평행 벌림)** — [노트](book/P035.md))
- **목둘레 턱 Ⓘ**(P.22 — Ⓑ + 다트 닫기, 목둘레 호 1/3·2/3 두 절개 균등 각 θ/2 · 박기 끝 2cm, 앞 틈 6.52 · 뒤 2.09cm — **위치·배분·깊이는 책에 없어 사용자 확정** — [노트](book/P022.md)) — `designFlare.neckTuck`
- **목둘레 턱 Ⓙ**(P.23 — Ⓘ + 앞·뒤 중심 **평행 띠** 폭 T = 앞 목둘레 틈 합 6.524cm 공통 · 박기 끝 새 중심선에서 2cm · 턱은 중심 쪽(표시 전용) · 띠 윗변 수평 — **절개는 «Ⓘ와 같이» A안, 띠·박기 끝·방향은 사용자 확정(2026-10-04)** — [노트](book/P023.md)) — `designFlare.centerBand` / `body.neckTuck:"J"`
- **목둘레 개더 Ⓚ**(P.24 — Ⓑ + 다트 전부 닫고 목둘레 **절개 1곳**(SNP 에서 앞 4 · 뒤 3cm) 벌림 · 개더 분량 앞 ●×1(6.752) · 뒤 ∅×0.5(1.005) · 개더 구간 = 절개 지점~중심(SNP 쪽 제외, **사용자 확정**) · 봉제 목둘레 앞 11.13 · 뒤 8.70 — [노트](book/P024.md)) — `designFlare.neckGather` / `body.neckGather:true`
- **목둘레 개더 Ⓛ**(P.25 — Ⓚ + 앞·뒤 중심 **평행 띠** ☒ = 총 개더 분량 − 쐐기 틈 = 앞 ●(6.752) · 뒤 0.5∅(1.005) · 총 분량 앞 ●×2(13.504) · 뒤 ∅×1.5(3.014) · 봉제 목둘레 = 원래 목둘레(앞 11.13 · 뒤 7.69) · **■ = 쐐기 틈은 사용자 확정, 뒤 도해 «5 정도» 는 산식과 양립 불가한 미해결 개략 표기** — [노트](book/P025.md)) — `designFlare.neckGatherBand` / `body.neckGatherBand:true` (Ⓚ 키와 분리)
- **보류**: 없음 — 몸판 카탈로그 22 변형(A~V) 전부 실행 가능

★ [패턴학교] 「처리 방법」(P.157–163) 7연산의 대응표는 [docs/book/P157.md](book/P157.md).
디자인 단계 연결 현황(157·158·161·163)은 위 「지금 서 있는 곳」 표가 소유한다. 159·162 는 이 문서에서 따로 확인하지 않았다.

### 허리 이음선 Ⓜ (2026-09-28, `js/designWaistSeam.js` → 프리셋 연결)

body `{hemExtensionBelowWaistCm:20, waistSideOffsetCm:-1.5, hemSideOffsetCm:1, waistSeam:true}` 한 번 적용.
`computeGeometry` 가 shape·다트 재배분 **뒤** `designWaistSeam.split` 을 원자 호출한다 — `front`/`back` = **upper**
(소매·카라가 그대로 소비), `frontPeplum`/`backPeplum` = 별개 폐곡선, `waistSeam` = 검산 메타.
- 몸판: a·e 유지, b(앞)·d(뒤)를 apex 축 회전으로 닫고 반동은 진동 여유(앞 0.12 · 뒤 0.22cm). 닫힌 흔적 0.
- 페플럼: a·b·d·e 를 몸판과 같은 입 너비로 밑단까지 갈라 `buttJoin` 을 다트마다 순차 호출(pair id
  `<front|back>-peplum-<기호>`), 앞/뒤 각 한 장. 상·하 허리 이음 길이 일치(앞 19.32 · 뒤 14.93cm).
- 렌더: `designRenderer` 가 페플럼을 선택 조각으로 그린다. 배치는 `designLayout.peplumDisplayPiece` 로 **표시만**
  허리 아래(간격 3cm)로 내리고 짝(앞/뒤)의 offset 을 따른다 — geometry 좌표 불변, 4조각 겹침 0.
- 체크포인트: `check().waistSeam`(페플럼 닫힘·이음 길이 정합, 위반 시 완료 차단), `bodiceResult` 가
  `frontPeplum/backPeplum/waistSeam` 을 동결 복제 보존, hash signature 에 페플럼 반영(없으면 기존 hash 와 동일).
  designResult 는 bodiceResult 를 통째로 담으므로 그대로 따라간다.
- UI: 기존 라인 선택 → 라인 적용. 허리 계측 줄은 수평 폭 대신 «허리 이음선 적용 — 상·하 조각 분리» 와 이음 길이
  검산을 보여 준다. 다른 프리셋(A 등)을 적용하면 페플럼·안내가 사라진다.
- **✅ 확정 결정(2026-09-29, 사용자 확정 — 더 이상 미확정·우리 해석이 아니다)**:
  1. **페플럼 다트는 밑단점을 apex 로 삼아 맞댄다.** 검증: `buildPeplum` 이 각 다트 apex 를 분할 직전
     (아직 join 을 거치지 않은) 밑단 직선 위의 점(`hs ∈ (0,1)`)으로 둔다. 순차 `buttJoin` 이 강체
     회전이라, 두 번 이상 join 을 거친 다트의 apex 는 **합쳐진 페플럼 안에서는 회전된 좌표**로
     나타나지만 — 그래도 그 조각의 밑단 변과는 정확히 맞물려 있다(강체 변환은 "apex 가 밑단 위"라는
     성질 자체를 보존한다). 최종 페플럼의 밑단은 다트 수+1 개 변으로 나뉘고, 각 이음점이 정확히
     맞물리는 것(부동소수 1e-6cm 이내)으로 이를 확인했다.
  2. **몸판 b·d 는 다트 apex 에서 진동 쪽으로 수평 절개해 닫는다.** 검증: `rayHit` 이 apex 의 y 좌표를
     고정한 채(`y=A.y`) 옆선(`Ws-Wc` 방향)을 향해 ray-cast 하고, 진동선(곡선)과 만나는 점을 찾는다.
     절개 끝점 T 는 진동/옆선 경계 위에 있고(중심 쪽이 아니다), apex 대비 중심에서 더 먼 쪽으로
     이동한다. 실측: 앞 Δy=1.2e-4cm·뒤 Δy=5.8e-6cm(곡선 경계에 스냅하며 생기는 부동소수 잔차,
     봉제 정밀도로는 0) — 둘 다 수평이다.
  - 두 결정 모두 `js/designWaistSeam.js` 헤더의 "★★ 잠긴 설계 결정 ★★" 절에 기록했고,
    `test/harness/waistSeamPresetCheck.js` §8(35개 검증, 앞·뒤 각각)이 회귀로 고정한다.
    테스트 전체 101 PASS(§1–8 합).
- **남은 한계(설계 변경 아님, 다음 작업 후보)**: (a) 회전한 옆 다트 c 의 `dart.attach` 는 stale —
  봉제 정합 게이트는 "패턴선 확정" 몫. (b) 소매·카라 완료 게이트를 Ⓜ 상태로 끝까지 밟아 보지는
  않았다(몸판 완료·소매 재파생 오류 0 까지만). (c) 밑단 곡선화(교재 «완만한 곡선»)는 아직 직선 이음
  — 페플럼 밑단이 다트마다 회전해 하나의 직선이 아니게 되는 지점이 바로 이 재작도 대상이다.

### 페플럼 플레어 Ⓝ (2026-09-29, `designJoin.buttSpread` → `designWaistSeam` 옵션 → 프리셋)

body = Ⓜ + `peplumFlare:true`(waistSeam 전제). 몸판(upper)은 Ⓜ 과 **바이트 동일**, 페플럼만 다르다.
- **사용자 확정 해석**: ●+■ = 맞댄 뒤 앞·뒤 페플럼 각각의 **완성 허리길이** / 총 플레어 ∅ = (●+■)×0.9 − 1 /
  절개 수로 **균등** 분배(교재 2곳 각 ∅/2) / 각 절개는 **허리선 입 점을 고정**하고 밑단 끝을 벌림 /
  교재 «약 5cm» 는 고정값이 아닌 참고 결과 / 밑단 fairing(접선 연속 cubic) 포함.
- 실측(B83·W64): 앞 완성 허리 19.32 → ∅ 16.39(절개 각 8.20, 각 ≈23.6°) / 뒤 14.93 → ∅ 12.44(각 6.22, ≈17.8°).
  교재 도해의 «약 5» 와 다른 것은 위 고정값이 아니라 계산 결과이기 때문이다(우리 완성 허리가 더 크다).
- 벌림은 밑단 끝점 사이 **직선거리(chord)** 기준이다(호 길이가 아니라).
- 허리선은 회전으로 꺾인다(부채꼴 — 길이는 그대로, 상·하 허리 이음 정합 유지). **허리 곡선 정리는 미구현**(패턴선 확정 몫).
- 체크포인트가 플레어 합·균등을 **다시 계산해 대조**하고 어긋나면 완료를 막는다(`waist-seam-flare-mismatch`).
- **제작 정보 표시(표시 전용, `js/peplumAnnotation.js` → `render.js`)**: 조각명·앞/뒤중심·옆선·허리선·밑단선·절개(①②+원래 다트 기호)
  안내선·쐐기·절개별 벌림량·총 플레어와 산식·Ⓐ/Ⓑ/Ⓒ 조각. Ⓝ 에만 있고 토글(`chkPeplumInfo`)로 끈다.
  geometry·계측·체크포인트·hash·hit 에 영향 없음(peplumAnnotationCheck 44).
- 검증: designJoinSpreadCheck 40 · peplumFlarePresetCheck 109 · 실제 UI 에서 Ⓝ 적용 → 몸판·소매·카라 완료 →
  Design 형상 완료까지 밟았다(콘솔 오류 0, storage 0키).

### 페플럼 절개 벌림 Ⓞ (2026-09-30, `designWaistSeam` `peplumCut` → 프리셋)

몸판 = 박시(허리 다트 a·b·d·e 없음·옆선 수직·밑단 +2), 페플럼 = WL 3등분 수직 절개 2곳을 `buttSpread` 로 순차 벌림.
판독·해석은 [docs/book/P028.md](book/P028.md). **사용자 확정**: 허리선·밑단 모두 fairing / chord 벌림 / ∅=완성 허리×0.4−2.
- 실측: 앞 ●24.45 → ∅7.78(절개 각 3.89 ≈ 교재 «4 정도», 11.2°) / 뒤 ●23.05 → ∅7.22(각 3.61).
- 허리 fairing 은 길이를 조금 줄인다(앞 0.051·뒤 0.042cm)·오목 꺾임을 메워 면적이 늘어난다 — 이음 정합은 «몸판 허리 − 페플럼 허리 = 감소량» 으로 검사한다.
- 제작 정보 표시는 Ⓝ 과 같은 모듈(`peplumAnnotation`) — 산식 문구 ×0.4−2 · P.163 조각 순서 · WL 3등분 규칙.
- 검증: peplumCutPresetCheck 149 · 실제 UI 에서 Ⓞ 적용 → 몸판·소매·카라 완료 → Design 형상 완료(콘솔 오류 0, storage 0키).
- 남은 것: 허리 곡선의 실제 봉제 정합은 패턴선 확정 몫.

### 허리 이음선 Ⓟ (2026-09-30, `designWaistSeam` `seamBelowWaistCm` → 프리셋)

Ⓞ 와 같은 구조 + 이음선 WL−5cm · ∅=●×0.3−1.5 · 밑단 옆 +1.5(페플럼 구간만). 판독·사용자 확정 6건은 [docs/book/P029.md](book/P029.md).
- 엔진: `liftSeam` 이 입력 조각을 이음선 y 에서 먼저 나눠 쓴다(옵션 없으면 호출 안 함 → A~Ⓞ **바이트 동일** 검증). 원래 WL 참고선은 upper 에 남긴다(옆허리 다트 c attach).
- 실측: 앞 ●24.447 → ∅5.834(각 2.917 ≈ «3 정도») / 뒤 ●23.053 → ∅5.416. 체크포인트·소매·카라·Design 형상 완료 통과(콘솔 오류 0, storage 0키).
- 검증: peplumSeamLowPresetCheck 83 · 전체 통과. 표시 정보는 «이음선(WL−5)» 로 표기.
- 남은 것: 몸판 `waist` 계측(체크포인트 허리 줄)은 이제 이음선 둘레를 잰다(●와 같은 뜻). WL 참고선 자체의 계측 표시는 없다.

## 다음 후보 (아무것도 자동 착수하지 않는다 — 승인 후)

- **소매 Ⓓ·Ⓔ 플레어(P.42) — 구현·연결 완료, 커밋 `316ce4b`(Ⓓ)·`0abfeb4`(Ⓔ, push 완료 · Codex 재검증 관련 828 통과).** Ⓔ 앞/뒤 분할 = 소매산 × 소매 중심선(최고점 대비 B83 ≈0.26cm 차는 이 사례에 한해 허용). [book/P042.md](book/P042.md).
- **소매 Ⓕ 턱 소매(P.43, 카탈로그 순서 4) — 구현·연결 완료(2026-10-10, 미커밋 · Codex 검증 대기).** 김님 확정 3건 + 턱 방향 원문 반영. 다음 = 김님 화면 확인 → 커밋. 소맷부리 곡선 처리 반영(김님 승인). 미확정: 박기 끝(책에 없음 — 만들지 않음). 같은 쪽 Ⓖ 는 판독만 — 별도 승인 전 미착수. [book/P043.md](book/P043.md)

1. ~~`161 닫는다·벌린다` 순수 연산~~ → **✅ `js/designFlare.js` 구현 완료**(경로 A —
   `designLineTool` 의 검증된 ring/분할 재사용). 실제 앞·뒤판 실측: 앞 다트각 −18.25°·쐐기
   117.412(해석값 일치)·연결오차 3.6e-15 / 뒤 11.38°·157.852·**잔여 sliver 0.1029cm**(문서화된
   어깨다트 비대칭, 명시 세그먼트로 기록).
   ~~남은 것 = UI 연결 + 플레어 Ⓖ·Ⓗ 프리셋 해제, 밑단 fairing 결정~~ → **✅ 완료**(위 표 「처리 방법 161」 — 밑단 곡선 이음·Ⓖ·Ⓗ 프리셋·UI).
   **목둘레 턱 Ⓘ 는 ✅ 완료**(`designFlare.neckTuck` — 절개 여러 개 부채꼴을 한 번에 처리, [P022](book/P022.md)). **Ⓙ(P.23) ✅ 완료**(Ⓘ + `designFlare.centerBand`, [P023](book/P023.md)).
2. ~~`157 맞댄다` 순수 연산~~ → **✅ `js/designJoin.js` 구현 완료**(`buttJoin`). 두 폐곡선 +
   `joinPairId` + 양쪽 맞댐 구간 → B 를 강체 역방향 일치 → 중복 맞댐선 제거 → 한 장. 검산으로
   **둘레 = A+B−2·봉제선 / 면적 = 합**을 반환하고, 쌍 불일치·퇴화 구간·길이 불일치·형상 불일치·
   면적 0·자기교차·연결 실패를 원자적으로 거부한다(designJoinCheck 71 PASS).
   **남은 것**: (a) **맞댐 쌍(2겹 반원)을 geometry 에 저장하는 설계** — Ⓜ 은 다리 세그먼트 태그로 명시했다.
   (b) ~~UI·프리셋 연결~~ → **Ⓜ 로 완료**(범용 맞댐 도구는 만들지 않음).
   (c) **맞닿는 경계**(홈을 정확히 메우는 배치)는 self-intersection 으로 거부된다 — 요크·이음선
   같은 변 대 변 맞댐엔 문제없지만, 정식 처리는 별도 설계. 하네스 9(d)에 고정해 뒀다.
   → 요크·허리 이음선·프린세스는 이미 실행된다(위 「몸판 라인 카탈로그」). 이게 풀리면 열릴 남은 대상: 하이넥 n·후드 e·숄 안단.
3. **가슴 쪽 마무리** — `목표 완성 가슴`(여유량 역산). 작다. 다만 **"완성"(다트 닫은 뒤 91.1)과
   "외곽"(제도 폭 95) 중 무엇을 목표로 삼을지** 먼저 정해야 한다.
4. **엉덩이선 여유 검사** — [패턴학교] P.15 가 *"오버 블라우스는 엉덩이선에 8cm 이상"* 이라고
   검증 기준을 준다. 우리에겐 **엉덩이둘레 실측 입력이 없다**(치수 UI 추가 필요 → 원형 stage 영역).
5. **실사용 검증** — 아래 「다음에 확인할 것」에 적힌 원칙: *UI 기능 추가가 아니라 실제 사용 검증.
   반복적으로 확인되는 불편만 후속 수정.* 김이 첫 블라우스를 끝까지 만들어 보는 것.

## 미확정으로 남긴 것 (지어내지 않았다)

- **완성 허리 70.875 vs 공식이 뜻하는 70**(=W+6). `f` 가 접힘선 위 반쪽이라 생기는 0.875 가
  [학교책]의 의도인지 우리 해석인지 **확인 안 함**.
- **교재 인쇄 여유값과 우리 결과 차이** — 셰이프트 Ⓒ 17 vs 15.4 / Ⓓ 7.8 vs 5.3. 주원인은 우리가
  `c`·`f` 까지 잡는 것(≈3.6cm)이지만 **되돌려도 2cm·1.1cm 가 남는다**.
- **처리 방법의 제도 기호(2겹 반원·화살표) 출처 페이지를 못 찾았다** — P.164 는 봉제 너치였다.
  → 그래서 `designJoin` 은 맞댐 쌍을 **호출부가 명시**하게 두었다(표시를 geometry 에 지어내지 않았다).
- **[학교책] 원본 대조 전** — `docs/book/SCHOOL-BLOCK.md` 값은 우리 코드에서 역추출한 것.
- 몸판 계측기와 `designBodice` 역산 사이 **최대 0.0004cm 차이**(곡선 평탄화 해상도). 실무상 무의미.

---

## 다음에 확인할 것 (열려있는 이슈)

- **✅ (완료, 2026-07-08) `normalizeBakedSegments`** — [history/dart-engine.md](history/dart-engine.md)
  § normalizeBakedSegments 구현 참고. 파이프라인 `cut→rotate→bake→normalize→validate→render`, 단일 불변식
  (면적 0 서브패스 제거), ε=0.05cm 실측 확정, 다중다트 보존 검증 완료.
- **(다음 작업 후보) split/bake 아티팩트 근본 제거** — normalize는 사후 청소만 한다.
  `bakeFromSplitPieces`가 닫힌 흔적을 재분할로 재개방하는 것 자체를 막으려면
  split/bake가 열린 다트를 강체로 이고 가도록 재설계. 의도적 3개+ 다중다트 부채꼴
  워크플로우가 필요해지면 착수.
- **✅ (완료, 2026-07) 뒤판(back) 스트레스 검증** — [TESTING.md](TESTING.md) § 헤드리스 회귀 테스트 하네스
  참고. 결정론적 128/128 PASS + 무작위 600세대 이상 없음. back-shoulder-dart
  비대칭 잔여 sliver(~0.1cm)는 사용자 확인 결과 버그 아님(아래 항목 참고).
- **(신규 기능 후보, 다트이동과 별개 단계) 뒤어깨선 재봉선 정리 + 앞/뒤 어깨 길이
  맞춤** — 실제 패턴 작업에서 뒤판 다트이동 후 패턴사가 bSNP-bSP를 직선으로
  재작도하고 앞어깨 길이와 비교해 bSP를 조정하는 단계. [TESTING.md](TESTING.md) «뒤판(pivot=E) 검증 결과» 소견의
  sliver는 이 단계가 구현되면 자연히 흡수된다 — 다트이동 엔진 자체를 건드릴
  필요는 없음.
  **→ 2026-07 확정: 조사 중단. 이 보정은 원형·디자인이 아니라 "패턴선 확정"
  단계의 책임이다 — [CLAUDE.md](../CLAUDE.md) § 어깨 길이 보정의 단계 책임 경계 참고.**
- [history/dart-engine.md](history/dart-engine.md) § 최근 해결된 핵심 버그 (2026-07-03 세션)의 «알려진 사소한 관찰» 항목이 실제로 문제가 되는지 지켜보기
- **✅ (완료, 2026-07) 디버그 로그 정리** — [CLAUDE.md](../CLAUDE.md) § 디버그 플래그 참고. TEMP DEBUG
  전수 삭제, 나머지는 `dbg()` 한 함수로 통합, `DEBUG_DART_MOVE` 기본 `false`,
  캐시 버전 `?v=2026070732`. 실제 브라우저에서 뒤판 다트이동 재검증 완료(콘솔 오류 0).
- **✅ (완료, 2026-07) 앞판 다중다트 회귀 고정** — [TESTING.md](TESTING.md) § 헤드리스 회귀 테스트 하네스
  참고. 결정론 60 + 다중다트 49 + 오래된 다트 2층 감사 83 PASS, 골든 3종
  (`front/multidart/oldest_retarget.json`). 리팩터 착수 전 안전망 완성.
- **✅ (완료, 2026-07) 형상 엔진 재설계 순서 ③ — C0~C7 전부 완료** — [spec/dart-engine-layering.md](spec/dart-engine-layering.md)
  § 형상 엔진 재설계 스펙 + 각 「✅ C_ 완료」 참고. ①(`evaluateEndpoint`)·②(`findPhysicalSweepLimit`)·부호
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
- **✅ (완료, 2026-07) 캔버스 중심 UI 개편** — [history/ui-workspace.md](history/ui-workspace.md) § 캔버스 중심 UI 개편 완료 참고.
  사이드바 제거·상단 레일·팝오버·floating context strip·블루프린트 시각 체계까지 완료
  (커밋 `97586c7`→`fbb1c69`). JS·엔진·골든 무변경.
- **(다음 단계) UI 기능 추가가 아니라 실제 사용 검증** — 엔진은 C0~C7 완료, UI는 캔버스
  중심 개편 완료 상태다. 다음은 김이 실제로 써 보고 **반복되는 불편만** 후속 수정한다.
  새 UI 부품·기능을 선제적으로 추가하지 않는다.
- **✅ (완료, 2026-07) 원형 완료 기반 S1~S3** — [history/block-and-draft.md](history/block-and-draft.md)
  § ✅ 원형 완료 기반 S1~S3 구현 완료 참고. geometry 의미 표식(`bb05836`)·`captureBlockSnapshot`(`aff2baf`)·도구를 draft
  로 이동(`82ece4a`)·`window.blockWorkflow` 세션 완료본(`884c4ca`)·`원형 완료` 최소
  UI(`634acab`). blockMasterCheck 64 / blockWorkflowCheck 52 / runAll 통과 / 골든 diff 0.
  (테스트 수 SV2 `a278865` 반영.)
  (S1 시점 "design stage 는 계속 disabled"는 D1~D3b 에서 정정 — 아래 항목.)
- ~~**(다음 단계) designProject + reference renderer + 디자인 시작** → design stage 를
  정직하게 활성화(현재 disabled 유지)~~ → **✅ (완료, D1~D3b, 2026-07)**: [history/design-bodice.md](history/design-bodice.md) § ✅ 원형
  완료 → 디자인 복사 (D1~D3b) 구현 완료 참고. 로컬 5커밋(`ee417f5`→`854b3b5`→
  `b6d0a2e`→`7c7f027`→`ae5c255`). design 은 hasProject 게이트로 활성화, `디자인 시작`
  버튼으로만 project 생성, 완료본 version pinning.
- ~~**(그다음 기능 방향) ② 디자인 몸판 제도**~~ → **✅ (완료)** — ②~⑤ 현황은 위 「지금 서 있는 곳」 표.
  다섯 항목(여유량·완성 길이·옆선 실루엣·네크라인·앞중심 여밈)의 구현 기록은
  [history/design-bodice.md](history/design-bodice.md), 순서 원칙은 [CLAUDE.md](../CLAUDE.md) § 패턴 제작 7단계 책임 경계.
- ~~**(그다음 기능 후보) 뒤어깨선 정리 + 앞/뒤 어깨 길이 맞춤**~~ — **2026-07 조사 중단
  확정**: 원형·디자인 단계의 책임이 아니라 **"패턴선 확정"(디자인 → 재단 경계) 단계**에서
  다룬다. [CLAUDE.md](../CLAUDE.md) § 어깨 길이 보정의 단계 책임 경계 참고.
- **✅ legacy 순수 삭제 완료** — `chooseSignedBaseAngle`·`budgetMaxAngle`·
  `applyTimeSafeAngle`·`findMaxSafeAngle`·`findApplicableIntervals`는 C5d에서, apply의
  self-intersection/budget 게이트·C1 블록은 C7에서 삭제. [history/ui-workspace.md](history/ui-workspace.md) § Dead code 감사의
  `calc*CloseAngleByRotateHit` 3종은 이미 프로덕션에 없음(실측 확인).
