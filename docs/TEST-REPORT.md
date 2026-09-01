# Daybook production verification

## 2026-09-01 Markdown session export

- Properties `date/time/status` 전용, AM/PM range, Focus 축약, Today 완료/취소선, reading/usage session 출력을 자동 fixture로 검증했습니다.
- 안전한 Preview에서 checkbox, 취소선, code, emphasis를 DOM API로만 렌더링하며 Source/Preview 전환 시 하나의 고정 export snapshot을 사용합니다.
- 로컬 브라우저에서 데스크톱 및 390×844 모바일 화면, Source/Preview 전환, 콘솔 error/warning 없음과 가로 잘림 없음을 확인했습니다.

검증일: 2026-08-17 (America/Chicago)

## 자동 검증

- Node tests: 9/9 통과
- JavaScript syntax: app, source registry, merge, day model, Markdown, IndexedDB store, sync, Service Worker 통과
- 주요 fixture: 한글, emoji, Markdown 특수 문자, backtick, HTML 문자 원문, 부분 실패, 캐시 상태

## 브라우저 검증

- iPhone 세로 390×844: 하단 By app / Timeline / Markdown, 가로 overflow 없음
- iPhone 가로 844×390: 하단 navigation 유지, 오른쪽 rail 숨김, 가로 overflow 없음
- iPad 세로 1024×768 및 가로 1366×1024: 문서 + sticky tool rail, 가로 overflow 없음
- Empty day, repository-not-connected, Daily note, Settings/source status 표시 확인
- Markdown Preview/Source 전환, Copy 성공 toast, Download 버튼 실행 확인
- 서버 중단 후 Service Worker shell과 Daily note 화면 재로딩 성공
- console warning/error: 0

내장 브라우저는 Blob 다운로드를 download event로 노출하지 않아 실제 수신 이벤트 감지는 제한되었습니다. 파일명과 다운로드에 사용하는 내용이 Copy와 동일한 serializer라는 점은 자동 테스트와 코드 경로로 검증했습니다.

## 디자인 비교

승인 시안과 비교한 기준점:

1. 단일 세로 문서와 얇은 divider
2. Soft Rose 색상 token과 Lexend
3. 날짜 이동, freshness, Today 구조
4. iPhone 하단 navigation과 iPad 고정 tool rail
5. Timeline disclosure와 Markdown Preview/Source
6. Empty/offline/partial banner 및 항상 사용 가능한 Daily note

iPhone 가로에서 rail이 노출되던 차이는 최종 CSS에서 수정했습니다.

---

# 2차 검토 — 배포 후 (2026-08-19, 캐시 `2026.08.19-1`)

배포본 `6344bdc` 를 실제 브라우저로 다시 검사했습니다. **결함 9건**을 찾아 고쳤습니다.

- 자동 테스트 **17개 전부 통과** (9 → +8)
- 브라우저 검사 4개 화면 크기 · **console warning/error 0건**

## 1. 고친 것

| # | 심각도 | 문제 |
|---|---|---|
| 1 | **사용 불가** | **iPhone에서 Settings에 들어갈 방법이 없음.** `.tool-rail` 이 800px 미만에서 `display:none` 인데 `#open-settings` 가 그 안에만 있었습니다. 토큰을 넣을 수 없으니 iPhone에서는 어떤 기록도 불러오지 못하고 "Connect your private repository in Settings" 안내만 영원히 표시됩니다 |
| 2 | 동기화 누락 | **화면에 없는 날짜의 메모는 영영 업로드되지 않음.** `flushNote()` 가 `state.date` 로만 호출되고 outbox를 훑는 코드가 없었습니다. 메모를 쓰고 4초 안에 날짜를 옮기거나 앱을 닫으면 그 메모는 기기에만 남고, 상태 표시는 계속 "waiting to sync" 입니다 |
| 3 | iOS 확대 | **`.field select{font-size:12px}`** — 12px 입력에 포커스가 가면 iOS가 화면 전체를 확대합니다. 자체 디자인 기준("Inputs and textareas remain at least 16px on iOS")과 공통 기준을 함께 어겼습니다. 숨겨진 파일 입력도 10px이었습니다 |
| 4 | 성능 | **글자 하나 칠 때마다 IndexedDB를 두 번 열고 닫음** (10자에 `open()` 20회). 메모와 outbox를 매 입력마다 쓰는데 연결을 재사용하지 않았습니다 |
| 5 | 접근성 | 44px 미만 터치 영역 — Refresh 38×32, rail today 34×34, rail 탭 39px, 소스 상태 40px, 가로 화면 하단 탭 42px, skip link 35px |
| 6 | 콘솔 경고 | CSP `frame-ancestors` 는 `<meta>` 로 전달되면 브라우저가 무시하고 **매 로드마다 경고**합니다. GitHub Pages는 응답 헤더를 넣을 수 없으므로 제거했습니다 |
| 7 | 기준 미준수 | Lexend를 내장하면서 **라이선스 파일을 동봉하지 않음** (`WebApp_House_Style.md` 3장) |
| 8 | 사소 | `localStorage` 의 `daybook.date` 를 검증 없이 신뢰 — 값이 깨지면 달력이 빈 채로 그려집니다 |
| 9 | 사소 | `.gitignore` 가 없어 `.DS_Store` 가 추적되지 않은 채 남음 |

## 2. 고치는 방법

- **1번**: `.freshness-row` 에 `#open-settings-compact` 를 추가하고, rail을 숨기는 **두 media query 모두**에서 노출합니다. 승인 시안의 iPhone 화면에도 Settings 진입점이 없었으므로, 이는 **의도적인 플랫폼 보완**으로 기록합니다
- **2번**: `flushOutbox()` 가 `listItems('outbox')` 전체를 돌도록 하고, 시작 시점과 온라인 복귀 시점에 호출합니다
- **4번**: `store.js` 가 연결 하나를 재사용하고 `onversionchange` 로 양보합니다 (10자에 `open()` **0회**)

## 3. 기록해 두는 차이

- **미니 캘린더 칸이 34×36px** 입니다. rail 폭이 약 250px이라 7열 격자에서 44px 폭은 기하학적으로 불가능합니다. 높이만 28 → 36px로 올렸습니다. 날짜 이동은 헤더의 ‹ › 와 날짜 버튼으로도 모두 가능합니다
- 승인 시안의 iPhone 화면에는 워드마크가 없고 날짜가 한 줄(`Sun, Aug 17 ⌄`)이며 섹션마다 `›` 펼침 표시가 있습니다. 구현은 워드마크 + 두 줄 날짜 + `Open` 링크입니다. **시각적 차이가 남아 있으며 이번 수정 범위 밖입니다**

## 4. 회귀 테스트 8개

phone에서의 Settings 도달 가능성 · 16px 미만 포커스 대상 없음 · 44px 터치 영역 · outbox 전체 flush · DB 연결 재사용 · 저장된 날짜 검증 · 폰트 라이선스 동봉 · 캐시 버전 갱신.

## 2026-08-26 Journal 8 완료 검증

- **Pass — 자동:** 8-source 새 activity, Full/Compact field matrix, stale/context status, visible 복귀 refresh, source별 cache fallback, Markdown 안전성 및 기존 note 회귀 검사.
- **Pass — 브라우저:** desktop·390×844에서 Settings 8-source, Compact 안내, 가로 overflow 0, console warning/error 0.
- **Pending — private E2E:** 실제 token으로 8개 source write → Daybook read → offline flush → redaction 확인은 사용자 credential 없이 실행하지 않음.
- **Pending — 실기기:** iPhone/iPad Home Screen별 token/context 저장소와 Service Worker update는 실제 Safari에서 최종 확인 필요.

## 2026-08-26 today 소스 등록 (A-1 선행 배포)

계획서: `Plan/webapp-benchmark/Productivity_App_Benchmark_Plan_2026-08-26.md` A-1. `shared → daybook → today` 순서 중 2단계. today 앱 자체는 이후 커밋에서 배포되며, 이 커밋은 daybook이 today의 Journal 기록을 읽고 표시할 준비만 갖춥니다.

### 바꾼 것

- `src/sources.js` — `SOURCE_APPS`에 아홉 번째 항목 `{ id: 'today', label: 'Today', icon: '◉', href: '../today/' }` 추가. By app/Timeline/Settings 소스 상태는 전부 `SOURCE_APPS`를 순회하는 기존 코드를 그대로 쓰므로 별도 화면 코드 변경 없음.
- `src/day-model.js` — `sourceSummary`·`recordMeta`·`recordBody`에 `today` 분기 추가 (task 개수·done 개수만 표시, 밀린 개수·연속기록은 표시하지 않음). `actionLabel`에 `promoted`/`deferred` 추가(additive).
- `src/markdown.js` — `today()` 섹션 함수 추가(`## Today` → `### Tasks` 체크박스 목록 + 하위 단계는 full 모드에서만, `### Changes made this day`), `serializeMarkdown`에서 loom 다음에 호출. `actionLabel`에 동일하게 `promoted`/`deferred` 추가.
- `tests/day-model.test.mjs` — 신규 파일. today summary/meta/body 3건.
- `tests/markdown.test.mjs` — today 섹션 fixture 1건(체크박스, 하위 단계 full/compact 차이).
- `tests/static.test.mjs` — "여덟 개" → "아홉 개" 소스 목록 갱신, 캐시 버전 정규식 갱신.
- `sw.js` — 캐시 버전 `2026.08.26-journal8-activity1` → `2026.08.26-today-source` (캐시하는 파일 이름은 그대로지만 `sources.js`/`day-model.js`/`markdown.js` 내용이 바뀌었으므로 버전을 올림).

### 통과

- [x] `npm test` — **26/26 통과** (기존 23건 + 신규 3건)
- [x] `npm run test:syntax` — 전체 통과
- [x] today에 아직 아무 기록이 없어도(`day.apps.today`가 없거나 빈 배열) By app/Timeline/Markdown 전부 오류 없이 렌더링 (옵셔널 체이닝으로 가드됨)
- [x] Journal은 `today` 앱이 `today`의 `task`/`task-activity` kind만 사용한다고 가정 — 이 커밋은 화면 표시만 하고 today 저장소를 직접 열지 않음(`central reader uses journal projections and no foreign app storage` 테스트로 고정)
- [x] 기존 8개 앱의 by-app/Timeline/Markdown 출력에 회귀 없음 (기존 23개 테스트 그대로 통과)
- [x] 콘솔 오류 0건, 절대경로·외부 URL 없음(기존 정적 검사 통과)

### Pending — 실기기 및 today 배포 이후

- [ ] today 앱 배포 완료 후, 실제 today 기기에서 Journal 기록을 올린 뒤 daybook의 By app/Timeline/Markdown 세 화면에서 실제로 보이는지 확인
- [ ] iPhone/iPad Home Screen에서 새 daybook Service Worker 캐시로 갱신되는지
