# Daybook 사용 안내

## 기록 보기

- **By app**: Tide, Focus, Loom, Petal을 한 문서처럼 이어서 표시합니다. Folio의 하이라이트·메모·인용 내보내기는 **Folio notes**에 문서별로 표시하고, 파일 열기·읽기 활동은 Quill, Slate, Grove와 함께 **Files worked with**에 표시합니다.
- **Timeline**: 모든 record를 시간순으로 표시합니다. Details 또는 Show source text로 긴 원문을 펼칠 수 있습니다.
- **Markdown**: 안전한 Preview와 Source를 전환하고, 같은 serializer 결과를 복사하거나 `journal-YYYY-MM-DD.md`로 다운로드합니다.

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
3. Tide·Focus·Loom·Petal·Folio에서는 원문 업로드 여부를 별도로 정합니다. **Compact summaries**는 Daybook 표시/내보내기만 줄이며 이미 업로드된 본문을 지우지 않습니다.
4. 지원 앱에서 날짜 범위를 미리 보고 기존 기록을 가져옵니다. `exact`는 저장된 실제 시각, `inferred`는 현재 객체 상태에서 복원한 제한적 이력, `future-only`는 이 버전 이전 이력을 복원할 수 없다는 뜻입니다.
5. 각 앱에서 대표 활동을 한 번 수행하고 Daybook에서 **Refresh** 후 source의 마지막 성공 write와 해당 날짜 기록을 확인합니다.

기간별 **Remove content**는 현재 projection에 더 최신의 비본문 record를 쓰는 기능입니다. 앱 원본과 일반 Sync는 그대로이며 private Git 저장소의 과거 commit history를 완전히 지우지는 않습니다.
