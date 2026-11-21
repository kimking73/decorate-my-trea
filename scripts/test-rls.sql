-- 로컬 Postgres 에서 Supabase 환경을 흉내 내 RLS·권한을 검증하는 스크립트
\set ON_ERROR_STOP on
-- 사용법: createdb treetest && psql -d treetest -f scripts/test-rls.sql  (빈 DB 에서만 실행!)
drop schema if exists auth cascade; drop schema public cascade; create schema public;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  -- Supabase 의 서버 역할. 0002 의 submit_letter() 는 이 역할만 실행할 수 있다
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
-- 실서버와 같은 기본 권한만 준다. 테이블 권한(SELECT·INSERT·UPDATE…)은 마이그레이션이 직접 준다.
-- (Supabase 프로젝트에서 확인한 값: REFERENCES·TRIGGER·TRUNCATE. 여기서 ALL 로 주면
--  실서버에서만 권한이 모자라는 경우를 테스트가 놓친다 — 0004 가 그 구멍을 메웠다)
alter default privileges in schema public grant references, trigger, truncate on tables to anon, authenticated, service_role;
\i supabase/migrations/0001_init.sql
\i supabase/migrations/0002_submit_letter.sql
-- 0003 이전에 만든 교수님 트리 (운영 DB 에 이미 있는 트리 흉내) — 0003 이 닫아야 한다
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000c');
insert into public.trees (id, owner_id, slug, title, owner_name, kind) values
 ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000c', 'prof-old', '예전 교수님 트리', '예전 교수님', 'professor'),
 ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-00000000000c', 'user-old', '예전 일반 트리', '예전 학생', 'user');
\i supabase/migrations/0003_professor_open_likes_tree_color.sql
\echo '--- 0003 이전 트리: 교수님 트리는 닫히고 일반 트리는 열린 채'
do $$ begin
  if (select is_open from public.trees where slug = 'prof-old') then raise exception 'SHOULD CLOSE old professor tree'; end if;
  if not (select is_open from public.trees where slug = 'user-old') then raise exception 'SHOULD KEEP user tree open'; end if;
  raise notice 'ok: old professor tree closed, user tree open';
end $$;
\i supabase/migrations/0004_table_grants.sql

insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', '{"name":"주인"}'),
 ('00000000-0000-0000-0000-00000000000b', '{"name":"남"}');
insert into public.trees (id, owner_id, slug, title) values
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner-tree', '주인 트리');
-- 교수님 트리: 하나는 허락 대기(is_open=false), 하나는 열림
insert into public.trees (id, owner_id, slug, title, owner_name, kind, department, is_open) values
 ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'prof-kim', '김 교수님 트리', '김 교수님', 'professor', 'cse', false),
 ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'prof-lee', '이 교수님 트리', '이 교수님', 'professor', 'math', true);
insert into public.letters (tree_id, ornament_type, nickname, content, is_confession) values
 ('10000000-0000-0000-0000-000000000001', 'ball', '친구1', '메리크리스마스', false),
 ('10000000-0000-0000-0000-000000000001', 'heart', '몰래', '좋아해', true);

\echo '--- 프로필 트리거 (auth.users INSERT → profiles)'
select id, display_name from public.profiles order by id;

\echo '--- 공개 전: 주인 SELECT (0 이어야 함)'
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
select count(id) from public.letters;
\echo '--- 내 프로필 (자기 행 1 · 남의 행 0)'
select count(id) from public.profiles where id = '00000000-0000-0000-0000-00000000000a';
select count(id) from public.profiles where id = '00000000-0000-0000-0000-00000000000b';
\echo '--- 공개 전: 장식 RPC (고백 여부 컬럼이 없어야 함, 닉네임 그대로)'
select * from public.get_ornaments('10000000-0000-0000-0000-000000000001');
select * from public.get_stats();
\echo '--- anon 직접 INSERT (실패해야 함)'
reset role; set role anon;
do $$ begin
  insert into public.letters (tree_id, ornament_type, content) values ('10000000-0000-0000-0000-000000000001','ball','x');
  raise exception 'SHOULD NOT INSERT';
exception when insufficient_privilege then raise notice 'ok: insert denied';
end $$;
\echo '--- anon claim_code 조회 (실패해야 함)'
do $$ begin perform claim_code from public.trees; raise exception 'LEAK';
exception when insufficient_privilege then raise notice 'ok: claim_code hidden'; end $$;
\echo '--- anon 공개 시각 SELECT (1행, 공개 시각 표시용)'
select count(id) from public.app_config;
\echo '--- 일반 유저가 professor 트리 생성 (실패해야 함)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin insert into public.trees (owner_id, slug, title, kind) values ('00000000-0000-0000-0000-00000000000b','prof-x','x','professor');
  raise exception 'SHOULD FAIL';
exception when insufficient_privilege then raise notice 'ok: professor tree denied'; end $$;
\echo '--- 주인이 자기 트리 생성 (성공해야 함 — 0004 권한 보정)'
do $$ begin
  insert into public.trees (id, owner_id, slug, title, owner_name)
  values ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'b-tree', '내 트리', '나');
  raise notice 'ok: tree created by owner';
end $$;
\echo '--- 트리를 만들 때 claim_code·is_open 지정 (실패해야 함 — INSERT 는 컬럼 단위)'
do $$ begin insert into public.trees (owner_id, slug, title, claim_code) values ('00000000-0000-0000-0000-00000000000b','b-tree-2','x','GUESSED1');
  raise exception 'SHOULD FAIL';
exception when insufficient_privilege then raise notice 'ok: claim_code insert denied'; end $$;
do $$ begin insert into public.trees (owner_id, slug, title, is_open) values ('00000000-0000-0000-0000-00000000000b','b-tree-3','x',false);
  raise exception 'SHOULD FAIL';
exception when insufficient_privilege then raise notice 'ok: is_open insert denied'; end $$;
\echo '--- 일반 유저가 is_admin 수정 (실패해야 함)'
do $$ begin update public.profiles set is_admin = true; raise exception 'ESCALATED';
exception when insufficient_privilege then raise notice 'ok: is_admin locked'; end $$;

-- =========================================================
-- 0003: 허락 상태 · 하트 · 트리 색 (spec.md 4.6 · 4.7)
-- =========================================================
\echo '--- 하트: 비로그인(anon)은 실행 불가'
reset role; set role anon;
do $$ begin
  perform public.toggle_professor_like('10000000-0000-0000-0000-000000000002');
  raise exception 'SHOULD NOT LIKE';
exception when insufficient_privilege then raise notice 'ok: anon cannot like'; end $$;
\echo '--- 하트: 목록은 anon 도 조회 (누가 눌렀는지는 없음)'
select slug, is_open, like_count, liked_by_me from public.list_professors();

\echo '--- 하트: 로그인 사용자 1인 1개, 다시 누르면 취소'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare v jsonb;
begin
  v := public.toggle_professor_like('10000000-0000-0000-0000-000000000002');
  if (v ->> 'liked')::boolean is not true or (v ->> 'like_count')::int <> 1 then
    raise exception 'expected liked=true count=1, got %', v;
  end if;
  v := public.toggle_professor_like('10000000-0000-0000-0000-000000000002');
  if (v ->> 'liked')::boolean is not false or (v ->> 'like_count')::int <> 0 then
    raise exception 'expected liked=false count=0 (cancel), got %', v;
  end if;
  v := public.toggle_professor_like('10000000-0000-0000-0000-000000000002');
  if (v ->> 'liked')::boolean is not true or (v ->> 'like_count')::int <> 1 then
    raise exception 'expected liked=true count=1 again, got %', v;
  end if;
  raise notice 'ok: 1인 1하트 (토글)';
  -- 교수님 트리가 아니면 하트 없음
  v := public.toggle_professor_like('10000000-0000-0000-0000-000000000001');
  if v ->> 'error' <> 'not_found' then raise exception 'expected not_found, got %', v; end if;
  raise notice 'ok: 일반 트리에는 하트 없음';
end $$;
\echo '--- 누른 사람 비공개: professor_likes 직접 조회 불가 · RPC 반환에 user_id 없음'
do $$ begin perform 1 from public.professor_likes; raise exception 'LEAK';
exception when insufficient_privilege then raise notice 'ok: likes table hidden'; end $$;
do $$ begin
  if exists (select 1 from pg_proc
             where proname = 'list_professors' and pronamespace = 'public'::regnamespace
               and pg_get_function_result(oid) like '%user_id%') then
    raise exception 'LEAK: list_professors returns who liked';
  end if;
  raise notice 'ok: list_professors has no liker column';
end $$;
select slug, is_open, like_count, liked_by_me from public.list_professors();

\echo '--- 트리 색: 주인은 tree_color 를 바꾸고, is_open 은 못 바꾼다'
do $$ begin
  update public.trees set tree_color = 'snow', theme = 'night' where id = '10000000-0000-0000-0000-000000000004';
  raise notice 'ok: tree_color·theme saved';
end $$;
do $$ begin
  update public.trees set is_open = false where id = '10000000-0000-0000-0000-000000000004';
  raise exception 'SHOULD NOT CHANGE is_open';
exception when insufficient_privilege then raise notice 'ok: is_open locked for owner'; end $$;
-- 남의 트리는 RLS 로 0행 (권한은 있어도 바뀌지 않는다)
update public.trees set tree_color = 'pink' where id = '10000000-0000-0000-0000-000000000001';
select slug, tree_color, theme, is_open from public.trees where id = '10000000-0000-0000-0000-000000000004';

\echo '--- 허락 대기 트리는 편지를 받지 않는다'
reset role; set role service_role;
do $$
declare v jsonb;
begin
  v := public.submit_letter('10000000-0000-0000-0000-000000000002', 'ball', '친구', '몰래', false, 'ip-p1', 'client-p1');
  if v ->> 'error' <> 'tree_not_found' then
    raise exception 'expected tree_not_found for closed tree, got %', v;
  end if;
  raise notice 'ok: 닫힌 트리는 tree_not_found';
  v := public.submit_letter('10000000-0000-0000-0000-000000000003', 'ball', '친구', '열린 트리', false, 'ip-p2', 'client-p2');
  if (v ->> 'ok')::boolean is not true then
    raise exception 'expected ok for open tree, got %', v;
  end if;
  raise notice 'ok: 열린 트리는 저장';
end $$;

\echo '--- 일반 사용자는 트리를 열 수 없다 (관리자만)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.admin_set_tree_open('10000000-0000-0000-0000-000000000002', true);
  raise exception 'SHOULD NOT OPEN';
exception when raise_exception then raise notice 'ok: non-admin cannot open tree'; end $$;

\echo '--- 관리자는 트리를 열 수 있고, 그 뒤에는 편지가 저장된다'
reset role; update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000a';
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.admin_set_tree_open('10000000-0000-0000-0000-000000000002', true);
  raise notice 'ok: admin opened tree';
end $$;
select slug, title, kind, department, is_open, like_count from public.admin_list_special_trees();
reset role; set role service_role;
do $$
declare v jsonb;
begin
  v := public.submit_letter('10000000-0000-0000-0000-000000000002', 'ball', '친구', '이제 쓸 수 있어요', false, 'ip-p3', 'client-p3');
  if (v ->> 'ok')::boolean is not true then
    raise exception 'expected ok after open, got %', v;
  end if;
  raise notice 'ok: 열린 뒤에는 저장';
end $$;

\echo '--- 0003 을 다시 실행해도 관리자가 연 교수님 트리는 다시 닫히지 않는다'
reset role;
\i supabase/migrations/0003_professor_open_likes_tree_color.sql
do $$ begin
  if not (select is_open from public.trees where id = '10000000-0000-0000-0000-000000000002') then
    raise exception 'SHOULD STAY OPEN after re-running 0003';
  end if;
  raise notice 'ok: re-run 0003 keeps opened tree open';
end $$;

\echo '=== 공개 시각을 과거로 ==='
reset role; update public.app_config set reveal_at = now() - interval '1 minute';
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
\echo '--- 공개 후: 주인 SELECT (2, 고백 여부 포함)'
select nickname, content, is_confession from public.letters
 where tree_id = '10000000-0000-0000-0000-000000000001' order by created_at;
\echo '--- 공개 후: 다른 유저 SELECT (0)'
set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
select count(id) from public.letters;
\echo '--- 공개 후: anon SELECT (권한 없음)'
reset role; set role anon;
do $$ begin perform 1 from public.letters; raise exception 'LEAK';
exception when insufficient_privilege then raise notice 'ok: anon denied'; end $$;
select ornament_type, nickname from public.get_ornaments('10000000-0000-0000-0000-000000000001');

-- =========================================================
-- 0002 submit_letter(): service_role 만 실행 · 작성 제한 (spec.md 4.4 · 5.3)
-- =========================================================
\echo '--- submit_letter: anon 직접 호출 (실패해야 함)'
reset role; set role anon;
do $$ begin
  perform public.submit_letter('10000000-0000-0000-0000-000000000001'::uuid, 'ball', '친구', '내용', false, 'ip-x', 'client-x');
  raise exception 'SHOULD NOT CALL';
exception when insufficient_privilege then raise notice 'ok: anon cannot submit'; end $$;

\echo '--- submit_letter: authenticated 직접 호출 (실패해야 함)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.submit_letter('10000000-0000-0000-0000-000000000001'::uuid, 'ball', '친구', '내용', false, 'ip-x', 'client-x');
  raise exception 'SHOULD NOT CALL';
exception when insufficient_privilege then raise notice 'ok: authenticated cannot submit'; end $$;

\echo '--- 제한 테스트용 데이터: 어제(2시간 전) 10건 · 같은 IP 에서 방금 30건'
reset role;
insert into public.letters (tree_id, ornament_type, nickname, content, ip_hash, client_hash, created_at)
select '10000000-0000-0000-0000-000000000001', 'ball', '친구', '지난 편지 ' || g, 'ip-day', 'client-day', now() - interval '2 hours'
from generate_series(1, 10) g;
insert into public.letters (tree_id, ornament_type, nickname, content, ip_hash, client_hash, created_at)
select '10000000-0000-0000-0000-000000000001', 'ball', '친구', '몰린 편지 ' || g, 'ip-hot', 'client-hot-' || g, now()
from generate_series(1, 30) g;

\echo '--- submit_letter: service_role 은 저장, 제한은 거부'
set role service_role;
do $$
declare
  v_tree constant uuid := '10000000-0000-0000-0000-000000000001';
  v_res jsonb;
  v_ok int := 0;
  i int;
begin
  -- 1) 정상 저장 (id 반환)
  v_res := public.submit_letter(v_tree, 'heart', '친구', '메리 크리스마스', true, 'ip-a', 'client-a');
  if (v_res ->> 'ok')::boolean is not true or (v_res ->> 'id') is null then
    raise exception 'expected ok=true with id, got %', v_res;
  end if;
  raise notice 'ok: service_role 저장 %', v_res ->> 'id';

  -- 2) 같은 브라우저 분당 5 (위 1건 + 4건까지)
  for i in 2..5 loop
    v_res := public.submit_letter(v_tree, 'ball', '친구', '분당 ' || i, false, 'ip-a', 'client-a');
    if (v_res ->> 'ok')::boolean then v_ok := v_ok + 1; end if;
  end loop;
  if v_ok <> 4 then raise exception 'expected 4 more ok in a minute, got %', v_ok; end if;
  v_res := public.submit_letter(v_tree, 'ball', '친구', '여섯 번째', false, 'ip-a', 'client-a');
  if v_res ->> 'error' <> 'rate_client_minute' then
    raise exception 'expected rate_client_minute, got %', v_res;
  end if;
  raise notice 'ok: 같은 브라우저 분당 5 제한';

  -- 3) 같은 브라우저 트리당 하루 10 (client-day 는 지난 2시간 안에 이미 10건)
  v_res := public.submit_letter(v_tree, 'star', '친구', '열한 번째', false, 'ip-b', 'client-day');
  if v_res ->> 'error' <> 'rate_client_tree_day' then
    raise exception 'expected rate_client_tree_day, got %', v_res;
  end if;
  raise notice 'ok: 트리당 하루 10 제한';

  -- 4) 같은 IP 분당 30 (ip-hot 은 방금 30건)
  v_res := public.submit_letter(v_tree, 'star', '친구', 'IP 몰림', false, 'ip-hot', 'client-c');
  if v_res ->> 'error' <> 'rate_ip_minute' then
    raise exception 'expected rate_ip_minute, got %', v_res;
  end if;
  raise notice 'ok: 같은 IP 분당 30 제한';

  -- 5) 없는 트리
  v_res := public.submit_letter('20000000-0000-0000-0000-000000000009', 'ball', '친구', '내용', false, 'ip-e', 'client-e');
  if v_res ->> 'error' <> 'tree_not_found' then
    raise exception 'expected tree_not_found, got %', v_res;
  end if;
  raise notice 'ok: 없는 트리는 저장하지 않음';

  -- 6) 빈 편지
  v_res := public.submit_letter(v_tree, 'ball', '친구', '   ', false, 'ip-e', 'client-e');
  if v_res ->> 'error' <> 'invalid_content' then
    raise exception 'expected invalid_content, got %', v_res;
  end if;
  raise notice 'ok: 빈 편지는 저장하지 않음';
end $$;
reset role;
\echo '=== submit_letter 테스트 통과'
