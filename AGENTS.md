# AGENTS.md

이 저장소에서 작업하는 AI 에이전트를 위한 안내 파일입니다.

## 프로젝트 개요

Todo 앱. Express 서버(`server.js`)가 `public/`을 정적 서빙하면서 `/api/*` REST
엔드포인트를 제공하고, 데이터는 Supabase(Postgres)에 저장한다. 자세한 구조는
[README.md](./README.md) 참고.

## CLI

`cli.js`로 할 일 데이터를 조회할 수 있다. 반드시 `--env-file=.env`를 붙여서
실행해야 한다 (Supabase 접속 키를 이 방식으로 로드하도록 구성되어 있음).

```bash
node --env-file=.env cli.js list      # 할 일 목록 (완료 여부, 마감일순 정렬)
node --env-file=.env cli.js summary   # 전체/완료/마감 지남 개수, 우선순위·태그별 집계
```

- 두 명령 모두 **읽기 전용**이다. 데이터를 생성/수정/삭제하는 명령은 아직 없다.
- `db.js`의 기존 함수(`listTodos` 등)를 그대로 재사용한다 — CLI에 DB 로직을
  새로 만들지 말 것.

## 작업 시 주의사항

- Supabase 접속 키(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)는 `.env`에만
  있고 git에 커밋되지 않는다. 코드에 하드코딩하거나 커밋하지 말 것.
- 데이터를 생성/수정/삭제하는 등 되돌리기 어려운 작업을 하기 전에는 먼저
  git commit으로 현재 상태를 저장해 되돌릴 지점을 만든다.
- 프론트엔드(`public/`)는 항상 `/api/*`를 통해서만 데이터에 접근한다. Supabase에
  직접 접근하는 코드를 프론트엔드에 추가하지 말 것 (RLS 우회 키가 노출됨).
