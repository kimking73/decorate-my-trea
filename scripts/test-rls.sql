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
\i supabase/migrations/0005_professor_read_link.sql

-- 0006 이전에 REST 로 직접 넣은 값처럼, 일반 트리에 chalkboard 가 저장돼 있는 상태를 흉내 낸다.
-- 0006 는 이 값을 지우지 않고 기본 테마로 되돌린 뒤 제약을 건다.
update public.trees set theme = 'chalkboard' where slug = 'user-old';
\i supabase/migrations/0006_s21_constraints_and_rpcs.sql
\echo '--- 0006: 일반 트리에 저장돼 있던 chalkboard 를 기본 테마로 되돌린다'
do $$ begin
  if (select theme from public.trees where slug = 'user-old') <> 'classic' then
    raise exception 'SHOULD RESET user tree chalkboard to classic';
  end if;
  raise notice 'ok: user tree chalkboard reset to classic';
end $$;

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
-- 0003 은 admin_list_special_trees() 를 다시 만들어 0005 의 read_key 를 빼므로 0005 도 다시 실행한다
-- (운영 DB 에서도 0003 을 다시 돌렸다면 0005 를 이어서 돌린다. 0005 는 재실행해도 안전)
\i supabase/migrations/0005_professor_read_link.sql

-- =========================================================
-- 0005: 교수님 비밀 열람 링크 (spec.md 4.6 · 5.3) — 공개 전
-- 키는 세션 설정 test.read_key 에 담아 역할을 바꿔도 쓴다
-- =========================================================
\echo '--- 열람 키: 비관리자·anon 은 발급 불가'
reset role;
-- 숨김 편지 (열람 링크에도 나오면 안 됨)
insert into public.letters (tree_id, ornament_type, nickname, content, hidden, reported) values
 ('10000000-0000-0000-0000-000000000003', 'ball', '숨김', '숨긴 편지', true, true);
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.admin_issue_read_key('10000000-0000-0000-0000-000000000003');
  raise exception 'SHOULD NOT ISSUE';
exception when raise_exception then raise notice 'ok: non-admin cannot issue read key'; end $$;
reset role; set role anon;
do $$ begin
  perform public.admin_issue_read_key('10000000-0000-0000-0000-000000000003');
  raise exception 'SHOULD NOT ISSUE';
exception when insufficient_privilege then raise notice 'ok: anon cannot issue read key'; end $$;

\echo '--- 열람 키: 관리자는 교수님 트리에만 발급, 다시 발급하면 이전 키 무효'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.admin_issue_read_key('10000000-0000-0000-0000-000000000001');
  raise exception 'SHOULD NOT ISSUE for user tree';
exception when raise_exception then
  if sqlerrm <> 'not found' then raise; end if;
  raise notice 'ok: user tree has no read key';
end $$;
select set_config('test.old_key', public.admin_issue_read_key('10000000-0000-0000-0000-000000000003'), false) is not null as issued;
select set_config('test.read_key', public.admin_issue_read_key('10000000-0000-0000-0000-000000000003'), false) is not null as reissued;
do $$ begin
  if char_length(current_setting('test.read_key')) < 32 then raise exception 'key too short'; end if;
  if current_setting('test.read_key') = current_setting('test.old_key') then raise exception 'reissue returned same key'; end if;
  if public.check_read_key('prof-lee', current_setting('test.old_key')) then raise exception 'OLD KEY STILL VALID'; end if;
  if not public.check_read_key('prof-lee', current_setting('test.read_key')) then raise exception 'NEW KEY INVALID'; end if;
  raise notice 'ok: reissue invalidates old key';
end $$;
\echo '--- 열람 키: 관리자 목록에는 보인다'
select slug, read_key is not null as has_key from public.admin_list_special_trees() order by slug;

\echo '--- 열람 키: 관리자도 컬럼을 직접 읽거나 바꾸지 못한다 (함수로만)'
do $$ begin perform read_key from public.trees; raise exception 'LEAK';
exception when insufficient_privilege then raise notice 'ok: read_key hidden (admin direct select)'; end $$;
do $$ begin update public.trees set read_key = 'guessed-key-0000000' where id = '10000000-0000-0000-0000-000000000003';
  raise exception 'SHOULD NOT UPDATE';
exception when insufficient_privilege then raise notice 'ok: read_key update denied'; end $$;

\echo '--- 열람 키: 일반 유저·anon 은 read_key 컬럼을 못 읽고, 직접 넣지도 못한다'
set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin perform read_key from public.trees; raise exception 'LEAK';
exception when insufficient_privilege then raise notice 'ok: read_key hidden (authenticated)'; end $$;
do $$ begin insert into public.trees (owner_id, slug, title, read_key) values ('00000000-0000-0000-0000-00000000000b','b-tree-4','x','guessed-key-0000000');
  raise exception 'SHOULD FAIL';
exception when insufficient_privilege then raise notice 'ok: read_key insert denied'; end $$;
do $$ begin update public.trees set read_key = 'guessed-key-0000000' where id = '10000000-0000-0000-0000-000000000004';
  raise exception 'SHOULD NOT UPDATE';
exception when insufficient_privilege then raise notice 'ok: read_key update denied (owner)'; end $$;
reset role; set role anon;
do $$ begin perform read_key from public.trees; raise exception 'LEAK';
exception when insufficient_privilege then raise notice 'ok: read_key hidden (anon)'; end $$;

\echo '--- 열람 키: 공개 전에는 맞는 키여도 본문 0건 (키 확인만 true)'
do $$ begin
  if not public.check_read_key('prof-lee', current_setting('test.read_key')) then raise exception 'key should be valid'; end if;
  if (select count(*) from public.get_letters_by_read_key('prof-lee', current_setting('test.read_key'))) <> 0 then
    raise exception 'LEAK: letters before reveal';
  end if;
  raise notice 'ok: 0 letters before reveal';
end $$;
\echo '--- 열람 키: 빈 키·null·짧은 키·틀린 키는 거부'
do $$ begin
  if public.check_read_key('prof-lee', '') or coalesce(public.check_read_key('prof-lee', null), false)
     or public.check_read_key('prof-lee', 'short') or public.check_read_key('prof-lee', 'wrong-key-wrong-key-wrong-key-00') then
    raise exception 'bad key accepted';
  end if;
  -- 키가 없는 교수님 트리(prof-kim)에 null 키로 맞추기
  if coalesce(public.check_read_key('prof-kim', null), false) then raise exception 'null key matched null read_key'; end if;
  if (select count(*) from public.get_letters_by_read_key('prof-kim', null)) <> 0 then raise exception 'null key returned letters'; end if;
  raise notice 'ok: empty/null/short/wrong key rejected';
end $$;

-- =========================================================
-- 0006: 칠판 테마 제약 · 관리자 특별 트리 생성 RPC · 허락 대기 slug 숨김 (spec.md 4.6 · 4.7)
--   0003 을 다시 실행하면 list_professors()·admin_set_tree_open() 이 예전 정의로 돌아가므로,
--   최신 정의(0006)를 여기서 다시 적용한다 — 재실행해도 안전한지도 함께 확인된다.
-- =========================================================
\echo '--- 0006 다시 적용 (0003 재실행 뒤에도 최신 정의가 남는다)'
reset role;
\i supabase/migrations/0006_s21_constraints_and_rpcs.sql

\echo '--- 0006: 일반 트리 주인이 theme=chalkboard 로 바꾸기 (실패해야 함 — check 제약)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare v_theme text;
begin
  select theme into v_theme from public.trees where id = '10000000-0000-0000-0000-000000000004';
  begin
    update public.trees set theme = 'chalkboard' where id = '10000000-0000-0000-0000-000000000004';
  exception when check_violation then
    raise notice 'ok: chalkboard denied on user tree';
  end;
  if (select theme from public.trees where id = '10000000-0000-0000-0000-000000000004') <> v_theme then
    raise exception 'SHOULD NOT SAVE chalkboard on user tree';
  end if;
end $$;

\echo '--- 0006: 교수님 트리는 chalkboard 를 그대로 쓸 수 있다 (제약은 일반 트리만)'
reset role; update public.trees set theme = 'chalkboard' where id = '10000000-0000-0000-0000-000000000003';
do $$ begin
  if (select theme from public.trees where id = '10000000-0000-0000-0000-000000000003') <> 'chalkboard' then
    raise exception 'SHOULD ALLOW chalkboard on professor tree';
  end if;
  raise notice 'ok: chalkboard allowed on professor tree';
end $$;

\echo '--- 0006: admin_create_special_tree — 일반 사용자는 만들 수 없다'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare v jsonb;
begin
  v := public.admin_create_special_tree('남의 교수님 트리', '남 교수님', 'prof-evil');
  if v ->> 'error' <> 'not_allowed' then raise exception 'expected not_allowed, got %', v; end if;
  if exists (select 1 from public.trees where slug = 'prof-evil') then raise exception 'SHOULD NOT CREATE'; end if;
  raise notice 'ok: non-admin cannot create special tree';
end $$;

\echo '--- 0006: admin_create_special_tree — anon 은 실행 권한이 없다'
reset role; set role anon;
do $$ begin
  perform public.admin_create_special_tree('교수님 트리', '교수님', 'prof-anon');
  raise exception 'SHOULD NOT CALL';
exception when insufficient_privilege then raise notice 'ok: anon cannot create special tree'; end $$;

\echo '--- 0006: 관리자가 만들면 허락 대기(is_open=false)로 만들어진다'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare
  v jsonb;
  r record;
begin
  v := public.admin_create_special_tree('새 교수님 트리', '새 교수님', 'prof-new', 'professor', 'chalkboard', 'cse', '한 학기 동안 감사했습니다');
  if (v ->> 'ok')::boolean is not true then raise exception 'expected ok, got %', v; end if;
  select slug, kind, theme, is_open, owner_id, department, description into r
    from public.trees where id = (v ->> 'id')::uuid;
  if r.slug <> 'prof-new' then raise exception 'slug lost: %', r.slug; end if;
  if r.is_open then raise exception 'SHOULD CREATE CLOSED (허락 대기)'; end if;
  if r.kind <> 'professor' or r.theme <> 'chalkboard' then raise exception 'wrong kind/theme: % / %', r.kind, r.theme; end if;
  if r.owner_id <> '00000000-0000-0000-0000-00000000000a' then raise exception 'owner should be the admin who made it'; end if;
  if r.department <> 'cse' then raise exception 'department lost'; end if;
  if r.description <> '한 학기 동안 감사했습니다' then raise exception 'description lost'; end if;
  raise notice 'ok: 관리자가 만든 교수님 트리는 허락 대기로 시작 (made by %)', v ->> 'slug';
end $$;

\echo '--- 0006: admin_create_special_tree — 잘못된 입력은 코드로 돌려준다'
do $$
declare v jsonb;
begin
  v := public.admin_create_special_tree('', '이름', 'prof-x1');
  if v ->> 'error' <> 'invalid_title' then raise exception 'expected invalid_title, got %', v; end if;
  v := public.admin_create_special_tree('제목', '', 'prof-x2');
  if v ->> 'error' <> 'invalid_owner_name' then raise exception 'expected invalid_owner_name, got %', v; end if;
  v := public.admin_create_special_tree('제목', '이름', 'BAD SLUG');
  if v ->> 'error' <> 'invalid_slug' then raise exception 'expected invalid_slug, got %', v; end if;
  v := public.admin_create_special_tree('제목', '이름', 'prof-new');
  if v ->> 'error' <> 'slug_taken' then raise exception 'expected slug_taken, got %', v; end if;
  v := public.admin_create_special_tree('제목', '이름', null, 'user');
  if v ->> 'error' <> 'invalid_kind' then raise exception 'expected invalid_kind, got %', v; end if;
  v := public.admin_create_special_tree('제목', '이름', 'prof-x3', 'professor', 'nope');
  if v ->> 'error' <> 'invalid_theme' then raise exception 'expected invalid_theme, got %', v; end if;
  v := public.admin_create_special_tree('제목', '이름', 'prof-x4', 'professor', 'chalkboard', 'nope');
  if v ->> 'error' <> 'invalid_department' then raise exception 'expected invalid_department, got %', v; end if;
  if (select count(*) from public.trees where slug like 'prof-x%') <> 0 then raise exception 'SHOULD NOT CREATE on invalid input'; end if;
  raise notice 'ok: 잘못된 입력은 error 코드로 (예외 문장 노출 없음)';
end $$;

\echo '--- 0006: list_professors() 는 허락 대기 트리의 slug 를 숨긴다'
reset role; set role anon;
do $$
declare
  r record;
  v_open int := 0;
  v_closed int := 0;
begin
  for r in select slug, is_open from public.list_professors() loop
    if r.is_open then
      if r.slug is null then raise exception 'open tree must keep its slug'; end if;
      v_open := v_open + 1;
    else
      if r.slug is not null then raise exception 'LEAK: closed tree slug %', r.slug; end if;
      v_closed := v_closed + 1;
    end if;
  end loop;
  if v_open = 0 or v_closed = 0 then
    raise exception 'need both open and closed professor trees (open %, closed %)', v_open, v_closed;
  end if;
  raise notice 'ok: 닫힌 트리 slug 숨김 (열림 % · 닫힘 %)', v_open, v_closed;
end $$;
select slug, is_open, like_count, liked_by_me from public.list_professors();

\echo '--- 0006: admin_set_tree_open 은 일반 트리를 대상으로 하지 않는다'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare v_before boolean;
begin
  select is_open into v_before from public.trees where id = '10000000-0000-0000-0000-000000000004';
  begin
    perform public.admin_set_tree_open('10000000-0000-0000-0000-000000000004', not v_before);
  exception when others then
    raise notice 'ok: 일반 트리는 admin_set_tree_open 대상이 아님 (%)', sqlerrm;
  end;
  if (select is_open from public.trees where id = '10000000-0000-0000-0000-000000000004') <> v_before then
    raise exception 'SHOULD NOT CHANGE is_open of a user tree';
  end if;
end $$;

\echo '--- 0006: 관리자는 새 교수님 트리를 열 수 있다 (허락 받은 뒤)'
do $$
begin
  perform public.admin_set_tree_open((select id from public.trees where slug = 'prof-new'), true);
  if not (select is_open from public.trees where slug = 'prof-new') then
    raise exception 'SHOULD OPEN the professor tree';
  end if;
  raise notice 'ok: 관리자가 교수님 트리를 열었다';
end $$;

\echo '--- 0006: 닫힌 트리는 목록에서 slug 가 null, 열면 slug 가 다시 보인다'
reset role; update public.trees set is_open = false where slug = 'prof-new';
set role anon;
select slug, is_open from public.list_professors() where owner_name = '새 교수님';
do $$ begin
  if (select slug from public.list_professors() where owner_name = '새 교수님') is not null then
    raise exception 'LEAK: closed tree slug';
  end if;
  raise notice 'ok: 다시 닫으면 slug 가 다시 숨는다';
end $$;

\echo '--- 0006 을 다시 실행해도 열린 트리·제약이 그대로다'
reset role;
\i supabase/migrations/0006_s21_constraints_and_rpcs.sql
do $$ begin
  if not (select is_open from public.trees where id = '10000000-0000-0000-0000-000000000002') then
    raise exception 'SHOULD KEEP opened professor tree open after re-running 0006';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trees_chalkboard_professor_only') then
    raise exception 'chalkboard constraint missing after re-run';
  end if;
  raise notice 'ok: re-run 0006 keeps trees open and the constraint in place';
end $$;

-- =========================================================
-- 0006: 허락 대기 트리는 테이블에서도 주인·관리자만 (spec.md 4.6)
--   list_professors() 의 slug 숨김과 별개로, 앱이 쓰는 anon·authenticated 키로 trees 를
--   직접 조회했을 때(REST: GET /rest/v1/trees?kind=eq.professor&is_open=eq.false&select=slug)
--   닫힌 트리가 보이지 않는지 역할마다 확인한다.
-- =========================================================
\echo '--- 0006: anon 이 trees 를 직접 읽어도 허락 대기 트리 주소는 없다'
-- 앞 절에서 남은 JWT sub 가 있으면 auth.uid() 가 맞아떨어져 행이 보인다. 실제 anon 키처럼 sub 를 비운다.
reset role; set request.jwt.sub = ''; set role anon;
\echo '   (리뷰 지적의 쿼리 모양 그대로: kind=professor · is_open=false · select=slug)'
select count(*) as closed_slugs_seen_by_anon from public.trees where kind = 'professor' and is_open = false;
do $$ begin
  if exists (select 1 from public.trees where kind = 'professor' and is_open = false) then
    raise exception 'LEAK: anon sees a closed professor tree';
  end if;
  if exists (select 1 from public.trees where slug = 'prof-new') then
    raise exception 'LEAK: anon read a closed tree slug';
  end if;
  if not exists (select 1 from public.trees where slug = 'prof-lee' and is_open) then
    raise exception 'open professor tree must stay readable for anon';
  end if;
  if not exists (select 1 from public.trees where slug = 'user-old') then
    raise exception 'user tree must stay readable for anon';
  end if;
  raise notice 'ok: anon sees open·user trees only';
end $$;
select slug, kind, is_open from public.trees order by kind, slug;

\echo '--- 0006: 다른 로그인 사용자에게도 남의 닫힌 트리는 안 보인다 (내 트리는 보인다)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if exists (select 1 from public.trees where slug in ('prof-new', 'prof-old')) then
    raise exception 'LEAK: other user sees a closed tree';
  end if;
  if not exists (select 1 from public.trees where slug = 'b-tree') then
    raise exception 'own tree must stay readable';
  end if;
  raise notice 'ok: 다른 사용자는 남의 닫힌 트리를 못 본다';
end $$;

\echo '--- 0006: 트리 주인은 자기 닫힌 트리를 주소로 볼 수 있다 (getTreeBySlug 의 주인 예외)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  if not exists (select 1 from public.trees where slug = 'prof-old' and not is_open) then
    raise exception 'owner must see own closed tree';
  end if;
  raise notice 'ok: 주인은 자기 닫힌 트리를 본다';
end $$;

\echo '--- 0006: 관리자는 닫힌 트리를 본다 (열어 주기 전에 확인)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if not exists (select 1 from public.trees where slug = 'prof-new' and not is_open) then
    raise exception 'admin must see closed tree';
  end if;
  raise notice 'ok: 관리자는 닫힌 트리를 본다';
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

\echo '--- 공개 후 열람 키 (anon): 맞는 키만 본문 (숨김 제외), 틀린 키·이전 키·다른 트리는 0건'
do $$
declare n int;
begin
  select count(*) into n from public.get_letters_by_read_key('prof-lee', current_setting('test.read_key'));
  if n <> 1 then raise exception 'expected 1 visible letter with key, got %', n; end if;
  if exists (select 1 from public.get_letters_by_read_key('prof-lee', current_setting('test.read_key')) where content = '숨긴 편지') then
    raise exception 'LEAK: hidden letter';
  end if;
  if (select count(*) from public.get_letters_by_read_key('prof-lee', 'wrong-key-wrong-key-wrong-key-00')) <> 0 then raise exception 'wrong key returned letters'; end if;
  if (select count(*) from public.get_letters_by_read_key('prof-lee', current_setting('test.old_key'))) <> 0 then raise exception 'old key returned letters'; end if;
  if (select count(*) from public.get_letters_by_read_key('prof-lee', '')) <> 0 then raise exception 'empty key returned letters'; end if;
  if (select count(*) from public.get_letters_by_read_key('prof-kim', current_setting('test.read_key'))) <> 0 then raise exception 'key worked on other tree'; end if;
  raise notice 'ok: read key letters after reveal (anon)';
end $$;
select nickname, content, is_confession from public.get_letters_by_read_key('prof-lee', current_setting('test.read_key'));
\echo '--- 공개 후 열람 키 (로그인한 다른 유저도 링크가 있으면 읽음)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from public.get_letters_by_read_key('prof-lee', current_setting('test.read_key'))) <> 1 then
    raise exception 'expected 1 letter for authenticated with key';
  end if;
  raise notice 'ok: read key works for authenticated';
end $$;
\echo '--- 공개 후 열람 키: 닫힌(허락 대기) 트리는 0건'
reset role; update public.trees set is_open = false where id = '10000000-0000-0000-0000-000000000003';
set role anon;
do $$ begin
  if (select count(*) from public.get_letters_by_read_key('prof-lee', current_setting('test.read_key'))) <> 0 then
    raise exception 'closed tree returned letters';
  end if;
  raise notice 'ok: closed tree returns no letters';
end $$;
reset role; update public.trees set is_open = true where id = '10000000-0000-0000-0000-000000000003';

-- =========================================================
-- 0007: 관리자 교수님 트리 정보 수정 (spec.md 3장 · 2.3)
-- =========================================================
\echo '--- 0007 다시 적용 (재실행해도 안전)'
reset role;
\i supabase/migrations/0007_admin_update_special_tree.sql

\echo '--- 0007: anon 은 실행 권한이 없다'
reset role; set role anon;
do $$ begin
  perform public.admin_update_special_tree('10000000-0000-0000-0000-000000000003', '바꿈', '이 교수님', 'classic', 'math', null);
  raise exception 'SHOULD NOT CALL';
exception when insufficient_privilege then raise notice 'ok: anon cannot update special tree'; end $$;

\echo '--- 0007: 일반 사용자는 고칠 수 없다 (not_allowed, 값 그대로)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare v jsonb;
begin
  v := public.admin_update_special_tree('10000000-0000-0000-0000-000000000003', '남이 바꾼 이름', '남', 'classic', 'cse', null);
  if v ->> 'error' <> 'not_allowed' then raise exception 'expected not_allowed, got %', v; end if;
  if (select title from public.trees where id = '10000000-0000-0000-0000-000000000003') <> '이 교수님 트리' then
    raise exception 'SHOULD NOT CHANGE title';
  end if;
  raise notice 'ok: non-admin cannot update special tree';
end $$;

\echo '--- 0007: 관리자는 교수님 트리 정보를 고칠 수 있다 (주소·상태는 그대로)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare
  v jsonb;
  r record;
begin
  v := public.admin_update_special_tree(
    '10000000-0000-0000-0000-000000000003', '이 교수님께 드리는 트리', '이 교수님', 'classic', 'phys', '한 학기 동안 감사했습니다');
  if (v ->> 'ok')::boolean is not true then raise exception 'expected ok, got %', v; end if;
  select title, owner_name, theme, department, description, slug, is_open, kind into r
    from public.trees where id = '10000000-0000-0000-0000-000000000003';
  if r.title <> '이 교수님께 드리는 트리' then raise exception 'title not saved: %', r.title; end if;
  if r.owner_name <> '이 교수님' then raise exception 'owner_name not saved'; end if;
  if r.theme <> 'classic' then raise exception 'theme not saved: %', r.theme; end if;
  if r.department <> 'phys' then raise exception 'department not saved'; end if;
  if r.description <> '한 학기 동안 감사했습니다' then raise exception 'description not saved'; end if;
  if r.slug <> 'prof-lee' then raise exception 'slug SHOULD NOT CHANGE: %', r.slug; end if;
  if not r.is_open then raise exception 'is_open SHOULD NOT CHANGE'; end if;
  if r.kind <> 'professor' then raise exception 'kind SHOULD NOT CHANGE'; end if;
  raise notice 'ok: 관리자가 교수님 트리 정보를 고쳤다 (주소· 허락 상태 그대로)';
end $$;

\echo '--- 0007: 학과를 비우면 선택 안 함(null)으로 저장된다'
do $$
declare v jsonb;
begin
  v := public.admin_update_special_tree('10000000-0000-0000-0000-000000000003', '이 교수님께 드리는 트리', '이 교수님', 'classic', '', '');
  if (v ->> 'ok')::boolean is not true then raise exception 'expected ok, got %', v; end if;
  if (select department from public.trees where id = '10000000-0000-0000-0000-000000000003') is not null then
    raise exception 'SHOULD CLEAR department';
  end if;
  if (select description from public.trees where id = '10000000-0000-0000-0000-000000000003') is not null then
    raise exception 'SHOULD CLEAR description';
  end if;
  raise notice 'ok: 학과·설명을 비우면 null';
end $$;

\echo '--- 0007: 일반 학생 트리는 대상이 아니다'
do $$
declare v jsonb;
begin
  v := public.admin_update_special_tree('10000000-0000-0000-0000-000000000004', '관리자가 바꾼 학생 트리', '학생', 'classic', null, null);
  if v ->> 'error' <> 'not_a_special_tree' then raise exception 'expected not_a_special_tree, got %', v; end if;
  if (select title from public.trees where id = '10000000-0000-0000-0000-000000000004') <> '내 트리' then
    raise exception 'SHOULD NOT CHANGE user tree';
  end if;
  raise notice 'ok: 일반 학생 트리는 고치지 않는다';
end $$;

\echo '--- 0007: 없는 트리·잘못된 입력은 코드로 돌려준다'
do $$
declare v jsonb; v_long text := repeat('가', 201);
begin
  v := public.admin_update_special_tree('20000000-0000-0000-0000-000000000009', '제목', '이름', 'classic', null, null);
  if v ->> 'error' <> 'not_found' then raise exception 'expected not_found, got %', v; end if;
  v := public.admin_update_special_tree('10000000-0000-0000-0000-000000000003', '', '이름', 'classic', null, null);
  if v ->> 'error' <> 'invalid_title' then raise exception 'expected invalid_title, got %', v; end if;
  v := public.admin_update_special_tree('10000000-0000-0000-0000-000000000003', '제목', '', 'classic', null, null);
  if v ->> 'error' <> 'invalid_owner_name' then raise exception 'expected invalid_owner_name, got %', v; end if;
  v := public.admin_update_special_tree('10000000-0000-0000-0000-000000000003', '제목', '이름', 'nope', null, null);
  if v ->> 'error' <> 'invalid_theme' then raise exception 'expected invalid_theme, got %', v; end if;
  v := public.admin_update_special_tree('10000000-0000-0000-0000-000000000003', '제목', '이름', 'classic', 'nope', null);
  if v ->> 'error' <> 'invalid_department' then raise exception 'expected invalid_department, got %', v; end if;
  v := public.admin_update_special_tree('10000000-0000-0000-0000-000000000003', '제목', '이름', 'classic', null, v_long);
  if v ->> 'error' <> 'invalid_description' then raise exception 'expected invalid_description, got %', v; end if;
  if (select title from public.trees where id = '10000000-0000-0000-0000-000000000003') <> '이 교수님께 드리는 트리' then
    raise exception 'SHOULD NOT CHANGE on invalid input';
  end if;
  raise notice 'ok: 잘못된 입력은 error 코드로 (예외 문장 노출 없음)';
end $$;

\echo '--- 0007: admin_list_special_trees 가 정보 수정 폼에 필요한 theme·description 을 돌려준다'
do $$
declare r record;
begin
  select theme, description into r from public.admin_list_special_trees() where slug = 'prof-lee';
  if r.theme is null then raise exception 'theme missing in admin_list_special_trees'; end if;
  raise notice 'ok: 목록에 theme·description 포함 (%)', r.theme;
end $$;

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
