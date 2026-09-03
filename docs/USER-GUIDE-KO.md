# Daybook 사용 안내

## 기록 보기

- **By app**: Clip, Focus, Petal을 한 문서처럼 이어서 표시합니다. Folio의 하이라이트·메모·인용 내보내기는 **Folio notes**에 문서별로 표시하고, 파일 열기·읽기 활동은 Quill, Slate, Grove와 함께 **Files worked with**에 표시합니다.
- **Timeline**: 모든 record를 시간순으로 표시합니다. Details 또는 Show source text로 긴 원문을 펼칠 수 있습니다.
- **Markdown**: 안전한 Preview와 Source를 전환하고, 같은 serializer 결과를 복사하거나 `journal-YYYY-MM-DD.md`로 다운로드합니다.

## Markdown Export 형식 (2026-09-01)

- Properties는 `date`, export snapshot `time`, `status`만 포함합니다. `timezone`과 `apps`는 제외합니다.
- 모든 시각은 AM/PM으로 표시합니다. 같은 AM/PM 안의 구간은 `10:02–10:32 AM`, 경계를 넘으면 `11:50 AM–12:10 PM`처럼 씁니다.
- Focus는 `시간 · (실제 분량) · 주제`만 표시합니다.
- Today는 그날 Today/Someday에 추가된 결과를 나누며, 종류에 따라 다르게 표시합니다: Task는 완료 `[x]` / 미완료 `[ ] ~~할 일~~`, Note는 `— 내용`, Event는 예정 시각(`HH:MM 내용`)입니다. 종류 정보가 없는 옛 기록은 지금처럼 Task로 표시됩니다.
- Folio·Petal·Cove는 읽기 시작/종료 시각과 활성 분량을, Slate·Grove는 사용 시작/종료 시각과 활성 분량을 표시합니다. 기존 기록만 있는 과거 날짜에는 새 세션 줄이 소급 생성되지 않습니다.
- Clip은 기록 시각과 내용만 표시합니다. Full/Compact 설정은 메모·인용 같은 긴 본문의 포함 범위에만 영향을 줍니다.

## 오프라인과 실패

- 네트워크가 없으면 마지막으로 성공한 날짜 캐시와 Daily note를 계속 읽을 수 있습니다.
- 한 source가 실패해도 다른 source와 Daily note는 계속 동작합니다.
- Daily note가 아직 원격에 반영되지 않았으면 **Saved on this device · waiting to sync**가 표시됩니다.

## 개인정보

- Source 앱의 Journal 포함 설정은 앱마다 별도이며 기본적으로 꺼져 있습니다.
- Folio는 사용자가 Journal을 켠 경우 문서 제목·위치·활동을 전송합니다. Folio 설정의 `Include selected text and note bodies`가 켜져 있을 때만 선택 문구와 메모 본문을 Daybook의 Full Markdown에 포함합니다. 원본 파일과 PDF 좌표는 전송하지 않습니다.
- Quill, Slate, Grove는 제목과 의미 있는 활동만 전송하고 본문·보드·맵 내용은 복제하지 않습니다.
- Settings의 backup은 Daybook 설정과 Daily note만 포함합니다.

## Journal 8 최종 연결 안내 (2026-08-26)

1. private `webapp-data`의 Contents 읽기/쓰기가 가능한 token을 Daybook에 저장합니다.
2. 각 기기·Home Screen 설치 문맥에서 8개 source 앱의 **Include in journal**을 따로 켭니다. 같은 Safari 계열이어도 설치 문맥별 저장소가 분리될 수 있습니다.
3. Clip·Focus·Petal·Folio에서는 원문 업로드 여부를 별도로 정합니다. **Compact summaries**는 Daybook 표시/내보내기만 줄이며 이미 업로드된 본문을 지우지 않습니다.
4. 지원 앱에서 날짜 범위를 미리 보고 기존 기록을 가져옵니다. `exact`는 저장된 실제 시각, `inferred`는 현재 객체 상태에서 복원한 제한적 이력, `future-only`는 이 버전 이전 이력을 복원할 수 없다는 뜻입니다.
5. 각 앱에서 대표 활동을 한 번 수행하고 Daybook에서 **Refresh** 후 source의 마지막 성공 write와 해당 날짜 기록을 확인합니다.

기간별 **Remove content**는 현재 projection에 더 최신의 비본문 record를 쓰는 기능입니다. 앱 원본과 일반 Sync는 그대로이며 private Git 저장소의 과거 commit history를 완전히 지우지는 않습니다.

## 2026-09-01 Revision 4 후속 수정 요약

이전 배포(2026-09-01 Revision 3) 이후 실사용 검토에서 나온 버그·출력 문제를 고쳤습니다.

- **Today 완료 판정**: `done`/`finalStatus`가 있으면 그 값을 신뢰합니다. 완료했다가 다시 연 할 일이 `actions`에 `completed`가 남아 있다는 이유만으로 다시 완료(`[x]`)로 표시되지 않습니다.
- **Cove**: In-app Reader로 읽은 시간(`(30m)`)과 `Open in Safari`로 읽은 근사 시간(`(~22m)`, 물결표)을 구분합니다. 60분이 넘어 돌아온 경우는 duration 없이 시각만 표시합니다.
- **Focus**: Break 세션은 표시하지 않습니다(`mode` 없는 구형 기록은 그대로 표시).
- **Petal**: 진행률을 기록하지 않은 세션은 `0% → 0%`를 붙이지 않고 생략합니다. 항목 간격을 Focus·Folio와 동일하게 맞췄습니다.
- **Clip**: 인용문을 목록 항목 아래 2칸 들여쓰기로 묶었습니다(`  > 내용`). Compact 모드에서도 본문을 유지합니다(Compact는 Folio/Petal의 긴 주석에만 적용).
- **Front matter time**: iOS Safari 16.4+에서 보이지 않는 특수 공백(U+202F)이 섞이던 문제를 고쳐 문서 전체가 일반 공백만 씁니다.
- **섹션 내부 정렬**: 각 섹션이 표시되는 시·분 오름차순으로 정렬됩니다.
- **Loom**: 이전에 빠졌던 block-activity(Changes made this day)와 Subtitle/Note/Detail을 되살렸습니다. 섹션 순서를 Focus → Today → Folio → Petal → Cove → Clip → Slate → Grove → Loom → Quill → Daily note로 정리했습니다.
- **Markdown escape**: `reading-1` 같은 제목에서 불필요한 백슬래시(`reading\-1`)가 보이던 문제를 고쳤습니다. Preview는 남은 escape 문자도 원래 글자로 표시합니다.

이번 범위에서 하지 않은 것: 과거(2026-09-01 이전) 활동에 대한 legacy fallback 줄 추가, `firstAt`–`lastAt` 기반 소급 시간 추정, 생산성 점수/순위 기능. Folio·Slate·Grove·Cove의 새 세션 기록은 각 앱의 이번 배포 이후 활동부터 제공됩니다.

## 2026-09-02 Settings 정리 — 글자 크기 6단계, 삭제 확인, 보존된 충돌

- **Text size**가 하우스 스타일 6단계(6/8/10/12/14/17px)로 바뀌었고, 옆의 `Reset`으로 기본값(12px)으로 되돌립니다. 이전 10~16px 범위보다 더 작게·크게 조절할 수 있습니다.
- **Clear activity cache**와 **Restore backup**을 누르면 이제 실행 전에 확인을 거칩니다. 다른 기기의 기록이나 Journal에는 영향이 없습니다.
- Settings의 Local data에 **Preserved conflicts** 버튼을 추가했습니다. Sync 도중 더 최신 원격 버전에 밀린 이 기기의 이전 메모 버전을 확인할 수 있는 화면으로, 지금까지는 만들어져 있었지만 열어볼 방법이 없었습니다. 각 항목을 복사하거나 더 이상 필요 없으면 개별적으로 지울 수 있습니다.
