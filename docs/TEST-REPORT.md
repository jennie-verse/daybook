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
