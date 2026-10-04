# 결정 색인 (append-only)

> **이 파일은 결정의 내용을 담지 않는다.** 결정의 **원문은 앵커가 가리키는 문서가 소유**한다.
> 여기엔 ID·상태·잠금·날짜·한 줄 라벨·원문 앵커·출처만 둔다. 재서술·요약·"핵심은 이것"식 부연을 쓰지 않는다
> (복사본은 원문과 갈라지는 순간 틀린 결정이 된다). 소유권·링크 규칙은 [README.md](README.md).

- `snapshot`: HEAD `c3f5954` (2026-10-04). 앵커의 `L번호` 는 그 시점의 줄 번호 **힌트**일 뿐이고, 앵커의 단일 기준은 **섹션 제목 접두어**다.
- 진행 상태(완료·다음 후보)는 이 파일이 아니라 [../docs/STATUS.md](../docs/STATUS.md) 가 소유한다.

## 잠금 등급

| 등급 | 의미 | 근거 |
|---|---|---|
| 🔒 `user-confirmed` | 원문에 **"사용자 확정/지시/답변/승인"이 글자 그대로** 적힌 결정 | 원문 표기 |
| 🏛 `constitution` | CLAUDE.md 가 위반 금지·잠긴 결정으로 선언했으나 "사용자 확정" 글자는 없는 것 | CLAUDE.md 의 선언 |

- 🔒 와 🏛 모두 **자동 정리 금지**(삭제·병합·재서술·이동·요약 압축). 변경은 아래 「상태 변경 로그」에 **행을 추가**하는 방식만 허용한다.
- 🏛 를 🔒 로 승격하려면 사용자 확인이 필요하다 — 이 색인이 임의로 올리지 않는다.

## 결정 색인

앵커 형식: `파일` `§ 제목 접두어` `L줄@c3f5954`. 원문 위치 → 아래 표의 "관련"은 같은 주제를 더 자세히 다루는 비소유 문서다.

### 🔒 user-confirmed

| ID | 날짜 | 라벨 | 원문 앵커 | 관련 |
|---|---|---|---|---|
| D-001 | 2026-07-07 | 젤리/물 = 현재 조각 하나 | [CLAUDE.md](../CLAUDE.md) `§ 지배 데이터 모델: "젤리/물` L58 | [dart-engine.md §1](dart-engine.md) |
| D-002 | 2026-07 | 패턴 제작 7단계 책임 경계 | [CLAUDE.md](../CLAUDE.md) `## 패턴 제작 7단계 책임 경계` L250 | — |
| D-003 | 2026-08 | Design 3단계 작업 순서 | [CLAUDE.md](../CLAUDE.md) `## Design 3단계 작업 순서` L286 | — |
| D-004 | 2026-07 | 어깨 길이 보정의 단계 책임 경계 | [CLAUDE.md](../CLAUDE.md) `## 어깨 길이 보정의 단계 책임 경계` L301 | — |
| D-005 | 2026-07 | 수정 금지 파일의 예외 승인 기록 | [CLAUDE.md](../CLAUDE.md) `## 작업 파일 범위` L141 | — |
| D-006 | 2026-07 | 형상 엔진 방향(계층화) | [spec](../docs/spec/dart-engine-layering.md) `## 형상 엔진 재설계 스펙` L9 | [dart-engine.md §3](dart-engine.md) |
| D-007 | 2026-07 | 평가 계층 책임 경계 | [spec](../docs/spec/dart-engine-layering.md) `### 계층 책임 경계` L34·L59 | [dart-engine.md §3·§6](dart-engine.md) |
| D-008 | 2026-07 | 계층화 확정 답변 | [spec](../docs/spec/dart-engine-layering.md) `### 확정된 결정 (사용자 답변)` L64 | [dart-engine.md §6](dart-engine.md) |
| D-009 | 2026-07 | C3 범위·0°/MIN 처리 | [spec](../docs/spec/dart-engine-layering.md) `### ✅ C3 완료` L166·L182·L206·L213 | — |
| D-010 | 2026-07 | C4 부호 선택 방식·legacy 삭제 시점 | [spec](../docs/spec/dart-engine-layering.md) `### ✅ C4 완료` L239·L282 | [dart-engine.md §3 · 부재 목록](dart-engine.md) |
| D-011 | 2026-07 | shape 골든 적용 범위·재설계 순서 | [spec](../docs/spec/dart-engine-layering.md) `### ✅ C7 완료` L400·L414 | — |
| D-012 | 2026-09 | 목둘레 턱·개더 Ⓘ–Ⓛ 확정 사항 | [STATUS](../docs/STATUS.md) `## 몸판 라인 카탈로그` L32·L33·L34·L35 | [book/INDEX.md](../docs/book/INDEX.md) |
| D-013 | 2026-09-28 | 허리 이음선 Ⓜ 확정 결정 | [STATUS](../docs/STATUS.md) `### 허리 이음선 Ⓜ` L58 | — |
| D-014 | 2026-09-29 | 페플럼 플레어 Ⓝ 확정 해석 | [STATUS](../docs/STATUS.md) `### 페플럼 플레어 Ⓝ` L81 | — |
| D-015 | 2026-09-30 | 페플럼 절개 벌림 Ⓞ 확정 사항 | [STATUS](../docs/STATUS.md) `### 페플럼 절개 벌림 Ⓞ` L98 | [book/P028.md](../docs/book/P028.md) |
| D-016 | 2026-09-30 | 허리 이음선 Ⓟ 확정 6건 | [STATUS](../docs/STATUS.md) `### 허리 이음선 Ⓟ` L107 | [book/P029.md](../docs/book/P029.md) |
| D-017 | 2026-07-03 | 캐시 버전 갱신 정책 | [history/dart-engine.md](../docs/history/dart-engine.md) `## 최근 해결된 핵심 버그 (2026-07-03` L81 | — |
| D-018 | 2026-07-08 | normalize 착수 지시 | [history/dart-engine.md](../docs/history/dart-engine.md) `## normalizeBakedSegments 구현` L213 | [dart-engine.md §1](dart-engine.md) |

### 🔒 user-confirmed — 근거 문서 계열 (`docs/history/`·`docs/book/`)

위와 같은 등급이다. 이 계열은 **라벨 = 해당 섹션 제목 그대로**(내용 요약 아님)이고 날짜는 제목에 있을 때만 적었다. 원문 문서가 결정 내용을 소유한다.

| ID | 날짜 | 라벨(섹션 제목) | 원문 앵커 | 관련 |
|---|---|---|---|---|
| D-201 | — | 제도 방법 (권말) | [book/INDEX.md](../docs/book/INDEX.md) `제도 방법 (권말)` L40 L43 L44 L45@c3f5954 | — |
| D-202 | — | P.18 — 프린세스 라인 Ⓔ | [book/P018.md](../docs/book/P018.md) `P.18 — 프린세스 라인 Ⓔ` L5@c3f5954 | — |
| D-203 | 2026-10-03 | ★ 사용자 확정 (2026-10-03, A안 — 도해 실측 기준, 더 이상 질문·해… | [book/P018.md](../docs/book/P018.md) `★ 사용자 확정 (2026-10-03, A안 — 도해 실측 기` L40@c3f5954 | — |
| D-204 | — | Ⓔ 와 달라지는 것 (그게 전부다) | [book/P019.md](../docs/book/P019.md) `Ⓔ 와 달라지는 것 (그게 전부다)` L19@c3f5954 | — |
| D-205 | — | 남은 위험 (설계 변경 아님) | [book/P021.md](../docs/book/P021.md) `남은 위험 (설계 변경 아님)` L63@c3f5954 | — |
| D-206 | — | P.22 — 목둘레 턱 Ⓘ «밑단 폭을 1cm 추가, 다트를 닫아 목둘레를 벌린다» | [book/P022.md](../docs/book/P022.md) `P.22 — 목둘레 턱 Ⓘ «밑단 폭을 1cm 추가, 다트를` L4@c3f5954 | — |
| D-207 | 2026-10-03 | 책에 없어 **사용자가 확정**한 것 (2026-10-03, 질문 1건으로 확정) | [book/P022.md](../docs/book/P022.md) `책에 없어 **사용자가 확정**한 것 (2026-10-03,` L14@c3f5954 | — |
| D-208 | — | 남은 위험 (설계 변경 아님) | [book/P022.md](../docs/book/P022.md) `남은 위험 (설계 변경 아님)` L45@c3f5954 | — |
| D-209 | — | P.23 — 목둘레 턱 Ⓙ «밑단 폭 1cm 추가, 다트를 닫아 목둘레를 벌리고 중… | [book/P023.md](../docs/book/P023.md) `P.23 — 목둘레 턱 Ⓙ «밑단 폭 1cm 추가, 다트를 닫` L4@c3f5954 | — |
| D-210 | 2026-10-04 | ✅ 사용자 확정 (2026-10-04, A안) | [book/P023.md](../docs/book/P023.md) `✅ 사용자 확정 (2026-10-04, A안)` L23@c3f5954 | — |
| D-211 | — | 남은 위험 (설계 변경 아님) | [book/P023.md](../docs/book/P023.md) `남은 위험 (설계 변경 아님)` L44@c3f5954 | — |
| D-212 | — | P.24 — 목둘레 개더 Ⓚ «밑단 폭을 1cm 추가, 다트를 닫아 목둘레를 벌린다» | [book/P024.md](../docs/book/P024.md) `P.24 — 목둘레 개더 Ⓚ «밑단 폭을 1cm 추가, 다트를` L4@c3f5954 | — |
| D-213 | 2026-10-04 | ✅ 사용자 확정 (2026-10-04, 질문 1건) | [book/P024.md](../docs/book/P024.md) `✅ 사용자 확정 (2026-10-04, 질문 1건)` L27@c3f5954 | — |
| D-214 | — | P.25 — 목둘레 개더 Ⓛ «Ⓚ 방법 + 중심에 개더 분량을 추가» | [book/P025.md](../docs/book/P025.md) `P.25 — 목둘레 개더 Ⓛ «Ⓚ 방법 + 중심에 개더 분량을` L4@c3f5954 | — |
| D-215 | 2026-10-04 | ✅ 사용자 확정 (2026-10-04, 질문 1건) | [book/P025.md](../docs/book/P025.md) `✅ 사용자 확정 (2026-10-04, 질문 1건)` L14@c3f5954 | — |
| D-216 | — | 산식·실측 (B83·W64) | [book/P025.md](../docs/book/P025.md) `산식·실측 (B83·W64)` L25@c3f5954 | — |
| D-217 | — | P.27 — 허리 이음선 Ⓝ (+ P.158 맞대면서 벌린다) — [패턴학교] | [book/P027.md](../docs/book/P027.md) `P.27 — 허리 이음선 Ⓝ (+ P.158 맞대면서 벌린다)` L6@c3f5954 | — |
| D-218 | — | P.28 — 허리 이음선 Ⓞ (+ P.163 기준점을 잡고 잘라서 벌린다) — [패… | [book/P028.md](../docs/book/P028.md) `P.28 — 허리 이음선 Ⓞ (+ P.163 기준점을 잡고 잘` L7 L10 L13@c3f5954 | — |
| D-219 | — | P.29 — 허리 이음선 Ⓟ (+ P.163 기준점을 잡고 잘라서 벌린다) — [패… | [book/P029.md](../docs/book/P029.md) `P.29 — 허리 이음선 Ⓟ (+ P.163 기준점을 잡고 잘` L14@c3f5954 | — |
| D-220 | 2026-09 | 우리 구현과의 관계 (2026-09 사용자 확정) | [book/P130.md](../docs/book/P130.md) `우리 구현과의 관계 (2026-09 사용자 확정)` L74@c3f5954 | — |
| D-221 | — | 1 — 꺾임선, 라펠의 안내선을 긋는다 | [book/P152.md](../docs/book/P152.md) `1 — 꺾임선, 라펠의 안내선을 긋는다` L19 L22@c3f5954 | — |
| D-222 | — | 1-❷ · 1-❸ 판독 (사용자 확정) | [book/P152.md](../docs/book/P152.md) `1-❷ · 1-❸ 판독 (사용자 확정)` L71@c3f5954 | — |
| D-223 | — | ★ 맞춤 표시를 하는 위치와 타이밍 (표 그대로) | [book/P164.md](../docs/book/P164.md) `★ 맞춤 표시를 하는 위치와 타이밍 (표 그대로)` L24@c3f5954 | — |
| D-224 | 2026-09 | 결정 (2026-09 사용자 확정) | [book/SCHOOL-BLOCK.md](../docs/book/SCHOOL-BLOCK.md) `결정 (2026-09 사용자 확정)` L63@c3f5954 | — |
| D-225 | 2026-08 | ✅ 원형(draft) 화면 소매 오른쪽 배치 + union 중앙 fit (2026-… | [history/block-and-draft.md](../docs/history/block-and-draft.md) `✅ 원형(draft) 화면 소매 오른쪽 배치 + union 중` L214@c3f5954 | — |
| D-226 | 2026-08 | ✅ Design 품·여유량(ease) (2026-08) — 옆선 바깥 평행 이동 | [history/design-bodice.md](../docs/history/design-bodice.md) `✅ Design 품·여유량(ease) (2026-08) — 옆` L173@c3f5954 | — |
| D-227 | 2026-08 | ✅ Design 옆선 실루엣 (2026-08) — 허리·밑단 옆선 이동(undera… | [history/design-bodice.md](../docs/history/design-bodice.md) `✅ Design 옆선 실루엣 (2026-08) — 허리·밑단` L207 L209@c3f5954 | — |
| D-228 | 2026-08 | ✅ Design 옆선 곡선화 (2026-08) — 허리 꺾임을 두 cubic 으로 … | [history/design-bodice.md](../docs/history/design-bodice.md) `✅ Design 옆선 곡선화 (2026-08) — 허리 꺾임을` L244@c3f5954 | — |
| D-229 | 2026-08 | Design 네크라인 3단계 (2026-08, 사용자 확정) — 기본형 선택 → 수… | [history/design-bodice.md](../docs/history/design-bodice.md) `Design 네크라인 3단계 (2026-08, 사용자 확정)` L274@c3f5954 | — |
| D-230 | 2026-08 | ✅ Design 네크라인 증분 1 (2026-08) — 라운드넥 + 공통 입력 | [history/design-bodice.md](../docs/history/design-bodice.md) `✅ Design 네크라인 증분 1 (2026-08) — 라운드` L292 L311@c3f5954 | — |
| D-231 | 2026-08 | ✅ Design 네크라인 증분 2 (2026-08) — V넥·스퀘어·보트 + 기본형… | [history/design-bodice.md](../docs/history/design-bodice.md) `✅ Design 네크라인 증분 2 (2026-08) — V넥·` L331@c3f5954 | — |
| D-232 | 2026-08 | ✅ Design 네크라인 증분 3 (2026-08) — parametric → ma… | [history/design-bodice.md](../docs/history/design-bodice.md) `✅ Design 네크라인 증분 3 (2026-08) — par` L444@c3f5954 | — |
| D-233 | 2026-08 | 증분 3 수명주기 보강 (2026-08) — 편집 재합성·전용선 보호·사용자 bou… | [history/design-bodice.md](../docs/history/design-bodice.md) `증분 3 수명주기 보강 (2026-08) — 편집 재합성·전용` L457@c3f5954 | — |
| D-234 | 2026-08 | 몸판 모양 단계 현황·다음 분기 (2026-08, 사용자 확정) | [history/design-bodice.md](../docs/history/design-bodice.md) `몸판 모양 단계 현황·다음 분기 (2026-08, 사용자 확정` L485 L492 L501@c3f5954 | — |
| D-235 | 2026-08 | ✅ Design 앞중심 여밈(front placket) v1 (2026-08) — … | [history/design-bodice.md](../docs/history/design-bodice.md) `✅ Design 앞중심 여밈(front placket) v1` L504@c3f5954 | — |
| D-236 | 2026-08 | ✅ Design 몸판 모양 완료 체크포인트 (2026-08) — bodiceChec… | [history/design-bodice.md](../docs/history/design-bodice.md) `✅ Design 몸판 모양 완료 체크포인트 (2026-08)` L561 L568@c3f5954 | — |
| D-237 | 2026-08 | bodiceResult 하드닝 (2026-08, 소매 단계 전 잠금) — 항목 1·… | [history/design-bodice.md](../docs/history/design-bodice.md) `bodiceResult 하드닝 (2026-08, 소매 단계 전` L603@c3f5954 | — |
| D-238 | 2026-08 | 소매산 봉제선 정합 확인 (2026-08, 읽기 전용) — sleeveMeasure | [history/design-bodice.md](../docs/history/design-bodice.md) `소매산 봉제선 정합 확인 (2026-08, 읽기 전용) — s` L628@c3f5954 | — |
| D-239 | — | C1c 스탠드 곡률 (직선+원호 복합, 어깨 경계) — 위 직선 스캐폴드를 곡선화 | [history/design-collar.md](../docs/history/design-collar.md) `C1c 스탠드 곡률 (직선+원호 복합, 어깨 경계) — 위 직` L71 L82@c3f5954 | — |
| D-240 | — | C2 칼라 본체 첫 스캐폴드 (2피스 셔츠 칼라 본체) | [history/design-collar.md](../docs/history/design-collar.md) `C2 칼라 본체 첫 스캐폴드 (2피스 셔츠 칼라 본체)` L120@c3f5954 | — |
| D-241 | 2026-09 | ✅ 교재 M형 위 칼라 제도 교정(M-v2, 2026-09) — 위 섹션의 "sub… | [history/design-collar.md](../docs/history/design-collar.md) `✅ 교재 M형 위 칼라 제도 교정(M-v2, 2026-09)` L332@c3f5954 | — |
| D-242 | — | ★ 발견: outline 은 깨끗한 폐곡선이 아니다 — 열린 다트 입구 (실측) | [history/design-lines-layout.md](../docs/history/design-lines-layout.md) `★ 발견: outline 은 깨끗한 폐곡선이 아니다 — 열린` L420@c3f5954 | — |
| D-243 | — | 검증 (격리 origin 127.0.0.1:8420, storage 0, saves… | [history/design-lines-layout.md](../docs/history/design-lines-layout.md) `검증 (격리 origin 127.0.0.1:8420, stor` L470@c3f5954 | — |
| D-244 | — | 결정·계약 (잠금) | [history/design-lines-layout.md](../docs/history/design-lines-layout.md) `결정·계약 (잠금)` (동명 제목 다수 — 줄 번호가 구분자) L478@c3f5954 | — |
| D-245 | 2026-08 | ✅ 도구 우선순위 게이트 (2026-08) — 선 도구 vs 배치 드래그 포인터 충… | [history/design-lines-layout.md](../docs/history/design-lines-layout.md) `✅ 도구 우선순위 게이트 (2026-08) — 선 도구 vs` L605@c3f5954 | — |
| D-246 | — | ★ 사용자 지시로 교정된 네 계약 구멍(초안 → 최종) | [history/design-result.md](../docs/history/design-result.md) `★ 사용자 지시로 교정된 네 계약 구멍(초안 → 최종)` L33@c3f5954 | — |
| D-247 | 2026-08 | 소매 모양 단계 계약 (2026-08, 사용자 확정) — 아직 착수 전 | [history/design-sleeve.md](../docs/history/design-sleeve.md) `소매 모양 단계 계약 (2026-08, 사용자 확정) — 아직` L8@c3f5954 | — |
| D-248 | 2026-08 | 첫 소매 확정안(2026-08, 사용자) + S1 구현 완료 | [history/design-sleeve.md](../docs/history/design-sleeve.md) `첫 소매 확정안(2026-08, 사용자) + S1 구현 완료` L53 L77@c3f5954 | — |
| D-249 | 2026-08 | ✅ S2 구현 완료 (2026-08) — 위팔·소매산 결합 조정 | [history/design-sleeve.md](../docs/history/design-sleeve.md) `✅ S2 구현 완료 (2026-08) — 위팔·소매산 결합 조` L83 L93 L98@c3f5954 | — |
| D-250 | 2026-08 | ✅ S3a 구현 완료 (2026-08) — 소매산 직접 편집 핵심 수명주기 | [history/design-sleeve.md](../docs/history/design-sleeve.md) `✅ S3a 구현 완료 (2026-08) — 소매산 직접 편집` L126@c3f5954 | — |
| D-251 | 2026-08 | S2 계약 (2026-08, 사용자 확정) | [history/design-sleeve.md](../docs/history/design-sleeve.md) `S2 계약 (2026-08, 사용자 확정)` L252@c3f5954 | — |
| D-252 | 2026-07 | 컨텍스추얼 CAD workspace 채택 (2026-07, 사용자 확정) — 위 U… | [history/ui-workspace.md](../docs/history/ui-workspace.md) `컨텍스추얼 CAD workspace 채택 (2026-07, 사` L99@c3f5954 | — |
| D-253 | 2026-07 | 플로팅 컨텍스추얼 캔버스 툴바 채택 (2026-07, 사용자 확정) — 위 CAD … | [history/ui-workspace.md](../docs/history/ui-workspace.md) `플로팅 컨텍스추얼 캔버스 툴바 채택 (2026-07, 사용자` L286@c3f5954 | — |
| D-254 | — | 실사용 근거 (실측) | [history/ui-workspace.md](../docs/history/ui-workspace.md) `실사용 근거 (실측)` (동명 제목 다수 — 줄 번호가 구분자) L563@c3f5954 | — |

### 🏛 constitution

| ID | 날짜 | 라벨 | 원문 앵커 | 관련 |
|---|---|---|---|---|
| D-101 | — | 프로젝트 비전 | [CLAUDE.md](../CLAUDE.md) `## 프로젝트 비전` L3 | — |
| D-102 | — | 제1법칙(종이 위에 있다) | [CLAUDE.md](../CLAUDE.md) `## 제1법칙` L11 | — |
| D-103 | — | 참고 문헌 이원 규칙([학교책]/[패턴학교]) | [CLAUDE.md](../CLAUDE.md) `## 프로젝트 개요` L18 | [book/README.md](../docs/book/README.md) |
| D-104 | 2026-07-08 | 다트 예산 = 사후 게이트(지배 결정 수정) | [CLAUDE.md](../CLAUDE.md) `### closeAngle / userAngle` L112 | [dart-engine.md §4](dart-engine.md) |
| D-105 | — | 다트 엔진 파일 분리·클래스화 보류 | [CLAUDE.md](../CLAUDE.md) `### 파일 분리 / 클래스화` L131 | — |
| D-106 | — | 이론·계획 → 승인 → 코드 | [CLAUDE.md](../CLAUDE.md) `## 작업 스타일 / 워크플로우` L152 | — |
| D-107 | — | 진동선 데이터는 localStorage 에만 있다 | [CLAUDE.md](../CLAUDE.md) `### ⚠️ 진동선 데이터는 git으로` L169 | [TESTING.md](../docs/TESTING.md) |
| D-108 | — | 안전 계약(저장 데이터) | [CLAUDE.md](../CLAUDE.md) `### 저장 데이터` L193 | [TESTING.md](../docs/TESTING.md) |
| D-109 | — | 안전 계약(골든 두 종류) | [CLAUDE.md](../CLAUDE.md) `### 골든 (두 종류를 구분한다)` L205 | [TESTING.md](../docs/TESTING.md) |
| D-110 | — | 안전 계약(커밋·변경 경계) | [CLAUDE.md](../CLAUDE.md) `### 커밋·변경 경계` L212 | — |
| D-111 | — | 안전 계약(검증) | [CLAUDE.md](../CLAUDE.md) `### 검증` L224 | [TESTING.md](../docs/TESTING.md) |
| D-112 | — | 자율 진행 규칙(멈춤 조건) | [CLAUDE.md](../CLAUDE.md) `## 자율 진행 규칙` L400 | — |

## 상태 변경 로그 (append-only — 행을 추가만 한다)

**유효 상태 = 해당 ID 의 가장 마지막 행.** 행이 없으면 `active`. 위 색인 표의 행은 수정하지 않는다.

| 로그# | ID | 일자 | 새 상태 | superseded_by | 사유 | 확인자 |
|---|---|---|---|---|---|---|
| (없음 — 2026-10-04 시점 전 항목 active) | | | | | | |

### 상태 값

- `active` — 유효.
- `superseded` — 다른 결정이 대체. **`superseded_by` 필수**, 원문·원 행은 그대로 보존한다(취소선·삭제 금지).
- `scoped` — 일부만 유효(범위를 사유에 적는다). 예: 1회성 승인 항목이 소진된 경우.

### 추가 규칙

1. 새 결정은 **다음 번호**를 받는다(🔒 D-0NN 이어서, 🏛 D-1NN 이어서). 번호는 재사용·재배열하지 않는다.
2. 🔒 항목의 상태 변경 행은 **사용자 확인**(확인자 칸에 기록) 없이 추가하지 않는다. 자동 정리 도구는 **제안만** 낸다.
3. 대체 결정이 새 앵커를 가지면 새 행으로 색인에 추가하고, 로그에 `superseded_by` 로 연결한다.
4. 원문 문서가 이동·개명되면 색인 행을 고치지 말고 **새 행 + 로그** 로 연결한다(옛 앵커는 이력으로 남는다).
5. 각 결정의 날짜는 원문에 적힌 날짜만 쓴다. 원문에 없으면 `—` 로 둔다(추정해 채우지 않는다).
