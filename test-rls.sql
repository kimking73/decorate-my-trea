-- 로컬 Postgres 에서 Supabase 환경을 흉내 내 RLS 를 검증하는 스크립트
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
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
\i supabase/migrations/0001_init.sql
\i supabase/migrations/0002_submit_letter.sql

insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', '{"name":"주인"}'),
 ('00000000-0000-0000-0000-00000000000b', '{"name":"남"}');
insert into public.trees (id, owner_id, slug, title) values
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner-tree', '주인 트리');
insert into public.letters (tree_id, ornament_type, nickname, content, is_confession) values
 ('10000000-0000-0000-0000-000000000001', 'ball', '친구1', '메리크리스마스', false),
 ('10000000-0000-0000-0000-000000000001', 'heart', '몰래', '좋아해', true);

\echo '--- 공개 전: 주인 SELECT (0 이어야 함)'
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
select count(*) from public.letters;
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
\echo '--- 일반 유저가 professor 트리 생성 (실패해야 함)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin insert into public.trees (owner_id, slug, title, kind) values ('00000000-0000-0000-0000-00000000000b','prof-x','x','professor');
  raise exception 'SHOULD FAIL';
exception when insufficient_privilege then raise notice 'ok: professor tree denied'; end $$;
\echo '--- 일반 유저가 is_admin 수정 (실패해야 함)'
do $$ begin update public.profiles set is_admin = true; raise exception 'ESCALATED';
exception when insufficient_privilege then raise notice 'ok: is_admin locked'; end $$;

\echo '=== 공개 시각을 과거로 ==='
reset role; update public.app_config set reveal_at = now() - interval '1 minute';
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
\echo '--- 공개 후: 주인 SELECT (2, 고백 여부 포함)'
select nickname, content, is_confession from public.letters;
\echo '--- 공개 후: 다른 유저 SELECT (0)'
set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
select count(*) from public.letters;
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
