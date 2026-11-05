-- 로컬 Postgres 에서 Supabase 환경을 흉내 내 RLS 를 검증하는 스크립트
\set ON_ERROR_STOP on
-- 사용법: createdb treetest && psql -d treetest -f scripts/test-rls.sql  (빈 DB 에서만 실행!)
drop schema if exists auth cascade; drop schema public cascade; create schema public;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
\i supabase/migrations/0001_init.sql

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
