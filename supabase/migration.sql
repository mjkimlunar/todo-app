-- Todo 앱 Supabase(Postgres) 스키마
-- 실행: Supabase 대시보드 → SQL Editor → 새 쿼리에 전체 붙여넣고 Run

create table if not exists todos (
  id            bigint generated always as identity primary key,
  title         text not null,
  description   text,
  is_completed  boolean not null default false,
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists tags (
  id    bigint generated always as identity primary key,
  name  text not null unique
);

create table if not exists todo_tags (
  todo_id  bigint not null references todos(id) on delete cascade,
  tag_id   bigint not null references tags(id) on delete cascade,
  primary key (todo_id, tag_id)
);

-- 조회 성능용 인덱스: "오늘 할 일만 보기", 우선순위 정렬
create index if not exists idx_todos_due_date on todos(due_date);
create index if not exists idx_todos_priority on todos(priority);
create index if not exists idx_todo_tags_tag_id on todo_tags(tag_id);

-- 수정 시 updated_at 자동 갱신 (Postgres 표준 방식: BEFORE UPDATE에서 NEW를 직접 수정)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_todos_updated_at on todos;
create trigger trg_todos_updated_at
before update on todos
for each row
execute function set_updated_at();

-- RLS 활성화. 아래 세 테이블 모두 정책(policy)을 하나도 만들지 않는다.
-- Supabase에서 RLS가 켜진 테이블에 정책이 없으면 anon/authenticated 역할은
-- 어떤 행도 읽거나 쓸 수 없다(기본 전면 차단). 이 앱의 백엔드(Express)는
-- service_role 키로 접속하며, service_role은 설계상 RLS를 우회하므로
-- 정상적으로 모든 작업을 수행할 수 있다.
-- 즉, service_role 키(.env에만 존재, 브라우저에는 절대 노출되지 않음)를
-- 가진 우리 서버만 데이터에 접근 가능하고, 그 외의 모든 접근(예: 유출된
-- anon 키로 직접 REST 호출)은 빈 결과/거부로 막힌다.
alter table todos enable row level security;
alter table tags enable row level security;
alter table todo_tags enable row level security;
