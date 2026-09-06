# Daybook GitHub Pages 배포 안내

## 자동 배포

1. 변경은 `Published/daybook/` 저장소의 `main` 브랜치에 반영합니다.
2. `.github/workflows/deploy.yml`이 Node 회귀 검사와 JavaScript 문법 검사를 실행합니다.
3. 검사가 통과하면 workflow가 명시한 runtime allowlist만 GitHub Pages에 배포합니다.
4. Actions의 `Test and deploy Daybook` 실행과 Pages URL이 모두 성공했는지 확인합니다.
5. 성공한 allowlist를 `Deliverable/daybook/`과 `Backup/daybook/`에 복제합니다. 두 스냅샷을 직접 수정하지 않습니다.

## Pages 설정

- 저장소 Settings → Pages → Source는 **GitHub Actions**로 설정합니다.
- 배포 주소는 `https://jennie-verse.github.io/daybook/`입니다.
- 저장소 루트의 상대 경로와 `.nojekyll`을 유지합니다.

## 업데이트 확인

`sw.js`는 cache-first로 동작합니다. runtime 파일을 바꾸면 `VERSION`도 올리고, 배포 뒤 일반 Safari와 홈 화면 앱에서 새 화면이 적용되는지 확인합니다. 오래된 화면이 남으면 앱의 Settings에서 캐시를 정리한 뒤 다시 열되, 먼저 설정과 노트를 백업합니다.
