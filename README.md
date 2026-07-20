# Todo 앱

마감일·우선순위·태그를 관리할 수 있는 할 일 관리 앱. Supabase(무료 클라우드 Postgres)에 데이터를 저장하는 과제 제출용 프로젝트입니다.

## 기능

- 할 일 추가 / 목록 보기 / 완료 표시 / 삭제
- 마감일, 우선순위(낮음/보통/높음), 태그(다대다) 지정
- 제목 검색, 태그 필터, "오늘 할 일만 보기" 필터

## 아키텍처

```
[브라우저 (public/index.html, app.js)]
   |  fetch (/api/todos, /api/tags)
   v
[Express 서버 (server.js)]
   |  supabase-js, service_role 키(.env)로 접속
   v
[Supabase Postgres: todos / tags / todo_tags]
```

- **프론트엔드**: 순수 HTML/CSS/JS (빌드 과정 없음)
- **백엔드**: Node.js + Express, `public/`을 정적 서빙하면서 `/api/*` REST 엔드포인트 제공
- **데이터베이스**: Supabase(Postgres) — 브라우저는 Supabase에 직접 접근하지 않고 항상 Express 서버를 거침

## 보안 조치 (RLS)

- Supabase 접속 키(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)는 서버의 `.env`에만 존재하고 브라우저에는 절대 노출되지 않음
- `todos`/`tags`/`todo_tags` 세 테이블 모두 **RLS(행 수준 보안) 활성화**, `anon`/`authenticated` 역할에는 정책을 하나도 부여하지 않음 → 이 두 역할은 읽기/쓰기 전면 차단
- 서버가 쓰는 **service_role 키**만 RLS를 우회해 정상 동작 (Supabase 설계상 트러스트된 백엔드용 키)
- 검증 결과: 공개용(`publishable`) 키로 직접 조회 시 빈 결과, 직접 추가 시도 시 `401` + RLS 위반 에러로 차단됨

## 로컬에서 실행하기

### 1. Supabase 프로젝트 준비
1. [supabase.com](https://supabase.com)에서 무료 프로젝트 생성
2. SQL Editor에 [supabase/migration.sql](./supabase/migration.sql) 내용을 붙여넣고 실행 (테이블 생성 + RLS 활성화)
3. Project Settings → API Keys에서 **Project URL**과 **secret key**(service_role) 확인

### 2. 환경변수 설정
`.env.example`을 참고해 `.env` 파일을 만들고 값을 채웁니다.

```
PORT=3000
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=발급받은-secret-key
```

### 3. 실행
```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 파일 구조

```
todo-app/
  server.js            Express 서버 (API + 정적 파일 서빙)
  db.js                Supabase 연동 (CRUD 함수)
  supabase/migration.sql   Supabase에서 실행할 스키마 + RLS
  public/              프론트엔드 (index.html, style.css, app.js)
  .env.example          필요한 환경변수 목록
```
