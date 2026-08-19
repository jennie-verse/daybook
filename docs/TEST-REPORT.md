# Daybook production verification

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
| 7 | 기준 미준수 | Lexend를 내장하면서 **라이선스 파일을 동봉하지 않음** (`webapp-standard.md` 3장) |
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
