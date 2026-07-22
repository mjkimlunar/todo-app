# Todo 앱

마감일·우선순위·태그를 관리할 수 있는 할 일 관리 앱. Supabase(무료 클라우드 Postgres)에 데이터를 저장하는 과제 제출용 프로젝트입니다.

## 기능

- 회원가입 / 로그인 (Supabase Auth, 이메일 인증 포함)
- 모임(household) 생성 / 초대 코드로 참여
- 모임을 만든 사람은 자동으로 **관리자**가 되어, 이메일로 초대 코드를 보낼 수 있음
  (Resend 이용)
- 할 일 추가 / 목록 보기 / 완료 표시 / 삭제
- 마감일, 우선순위(낮음/보통/높음), 태그(다대다) 지정
- 제목 검색, 태그 필터, "오늘 할 일만 보기" 필터

## 아키텍처

```
[브라우저 (public/index.html, app.js)]
   |  fetch (/api/auth/*, /api/households/*, /api/todos, /api/tags)
   |  Authorization: Bearer <access_token> + X-Household-Id
   v
[Express 서버 (server.js)]
   |  supabase-js .auth (로그인/가입/토큰 검증)
   |  supabase-js 데이터 접근 (service_role 키, db.js)
   |  Resend (email.js, 초대 메일 발송)
   v
[Supabase: Auth(auth.users) + Postgres(todos / tags / todo_tags / households / household_members)]
```

- **프론트엔드**: 순수 HTML/CSS/JS (빌드 과정 없음). Supabase에 직접 접근하지 않고
  항상 Express `/api/*`를 거침 (로그인도 마찬가지 — 브라우저에 Supabase 키를
  노출하지 않기 위해 Express가 Supabase Auth를 대신 호출하는 프록시 역할을 함)
- **백엔드**: Node.js + Express
- **인증**: Supabase Auth (이메일/비밀번호, 이메일 인증). Express가
  `access_token`을 검증해 `req.user`를 채우고, `household_members` 테이블로
  해당 모임 소속 여부와 역할(admin/member)을 확인함
- **이메일 발송**: Resend (`email.js`) — 관리자가 보내는 초대 메일 전용. Supabase
  Auth 자체의 회원가입 인증 메일은 별도로 Supabase 대시보드에서 SMTP를 설정해야 함
- **데이터베이스**: Supabase(Postgres)

## 권한 모델

- household를 만든 사람 → 그 household의 `admin`
- 초대 코드로 참여한 사람 → `member`
- `admin`만 `POST /api/households/:id/invite`로 이메일 초대를 보낼 수 있음
- 로그인 상태이면서 해당 household의 구성원(`household_members`)이어야만 그
  household의 할 일 데이터에 접근 가능 (초대 코드만 안다고 접근되지 않음)

## 보안 조치 (RLS)

- Supabase 접속 키(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)는 서버의 `.env`에만 존재하고 브라우저에는 절대 노출되지 않음
- `todos`/`tags`/`todo_tags`/`households`/`household_members` 테이블 모두 **RLS(행 수준 보안) 활성화**, `anon`/`authenticated` 역할에는 정책을 하나도 부여하지 않음 → 이 두 역할은 읽기/쓰기 전면 차단
- 서버가 쓰는 **service_role 키**만 RLS를 우회해 정상 동작 (Supabase 설계상 트러스트된 백엔드용 키)
- 검증 결과: 공개용(`publishable`) 키로 직접 조회 시 빈 결과, 직접 추가 시도 시 `401` + RLS 위반 에러로 차단됨
- 할 일 API는 로그인 토큰 검증 + household 소속 확인을 모두 통과해야 응답함

## 로컬에서 실행하기

### 1. Supabase 프로젝트 준비
1. [supabase.com](https://supabase.com)에서 무료 프로젝트 생성
2. SQL Editor에 [supabase/migration.sql](./supabase/migration.sql) 내용을 붙여넣고 실행 (테이블 생성 + RLS 활성화)
3. Project Settings → API Keys에서 **Project URL**과 **secret key**(service_role) 확인

### 2. Supabase Auth 설정 (회원가입 이메일 인증)
1. Supabase 대시보드 → Authentication → Sign In / Providers → Email에서 "Confirm
   email"이 켜져 있는지 확인 (기본값 켜짐)
2. Authentication → Emails → SMTP Settings에서 Resend SMTP 자격증명을 연결
   (기본 내장 발송은 시간당 발송량이 매우 적어 테스트 이상 용도로는 부족함)
   - Host: `smtp.resend.com`, Port: `465`, User: `resend`, Password: Resend API 키

### 3. Resend 설정 (초대 메일 발송)
1. [resend.com](https://resend.com)에서 가입 후 API 키 발급
2. 실제 서비스에서는 발신 도메인 인증 필요, 테스트 단계에서는 `onboarding@resend.dev`를
   발신자로 사용 가능

### 4. 환경변수 설정
`.env.example`을 참고해 `.env` 파일을 만들고 값을 채웁니다.

```
PORT=3000
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=발급받은-secret-key
RESEND_API_KEY=발급받은-resend-api-key
RESEND_FROM_EMAIL=onboarding@resend.dev
APP_URL=http://localhost:3000
```

### 5. 실행
```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 파일 구조

```
todo-app/
  server.js            Express 서버 (API + 정적 파일 서빙 + 인증 미들웨어)
  db.js                Supabase 연동 (CRUD, household/멤버십 함수)
  email.js             Resend로 초대 메일 발송
  supabase/migration.sql   Supabase에서 실행할 스키마 + RLS
  public/              프론트엔드 (index.html, style.css, app.js)
  .env.example          필요한 환경변수 목록
```
