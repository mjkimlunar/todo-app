# CLAUDE.md

이 파일은 Claude Code가 이 저장소를 열 때 자동으로 읽는 규칙 파일입니다.
전체 내용은 [AGENTS.md](./AGENTS.md)에 있습니다 (CLI/AGENTS.md는 여러 AI 도구가
공통으로 읽는 표준 형식이라 그쪽을 기준 문서로 유지하고, 여긴 Claude Code
전용 진입점 역할만 합니다). AGENTS.md를 먼저 읽고 그 내용을 따르세요.

빠른 요약:
- 조회는 `node --env-file=.env cli.js list|summary`
- 데이터 변경 전엔 반드시 git commit으로 체크포인트를 만들 것
- Supabase 키는 `.env`에만, 절대 코드/git에 넣지 말 것
