-- =========================================================
-- 0005 — 교수님 비밀 열람 링크 (T9, spec.md 4.6 · 5.3)
--
-- 교수님 트리의 주인은 만든 관리자 계정이다. 관리자가 교수님 트리마다 열람 키를 발급해
-- `/t/<slug>?key=<키>` 링크로 전달하면, 교수님은 로그인 없이 12/25 0시(is_revealed()) 이후
-- 편지 본문을 읽는다. 공개 시점은 이 함수들이 DB 에서 강제한다.
--
-- 재실행해도 안전하다 (add column if not exists · create or replace · drop function if exists).
-- =========================================================

-- 열람 키. claim_code 처럼 anon·authenticated 의 컬럼 권한(select·insert·update)에 넣지 않는다.
-- (0001 이 trees 의 select 를 컬럼 단위로 줬으므로 새 컬럼은 따로 grant 하지 않으면 읽을 수 없다.
--  0004 의 service_role 테이블 단위 select 에는 포함된다 — 서버 역할이므로 의도된 것.)
alter table public.trees add column if not exists read_key text unique;

-- ---------- 관리자: 열람 키 발급 (다시 발급하면 이전 키는 바로 무효) ----------
create or replace function public.admin_issue_read_key(p_tree_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_key text;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  -- gen_random_uuid() 는 v4 (난수 122비트). 하이픈을 빼 32자 16진수로 쓴다.
  v_key := replace(gen_random_uuid()::text, '-', '');
  update public.trees set read_key = v_key
  where id = p_tree_id and kind = 'professor';
  if not found then
    raise exception 'not found';
  end if;
  return v_key;
end;
$$;

revoke all on function public.admin_issue_read_key(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_issue_read_key(uuid) to authenticated, service_role;

comment on function public.admin_issue_read_key(uuid) is '관리자: 교수님 트리 열람 키 발급 (이전 키 무효) — spec.md 4.6';

-- ---------- 열람 키 확인 (공개 전에도 맞는지만 알려 준다. 본문·고백 여부는 내보내지 않음) ----------
create or replace function public.check_read_key(p_slug text, p_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(char_length(p_key) >= 16, false) and exists (
    select 1 from public.trees t
    where t.slug = p_slug and t.kind = 'professor' and t.read_key is not null and t.read_key = p_key
  );
$$;

revoke all on function public.check_read_key(text, text) from public, anon, authenticated, service_role;
grant execute on function public.check_read_key(text, text) to anon, authenticated, service_role;

comment on function public.check_read_key(text, text) is '교수님 열람 키가 맞는지 (공개 전 잠금 화면용) — spec.md 4.6';

-- ---------- 열람 키로 편지 본문 읽기: 키가 맞고 공개 이후이고 트리가 열려 있을 때만 ----------
create or replace function public.get_letters_by_read_key(p_slug text, p_key text)
returns table (id uuid, ornament_type text, nickname text, content text, is_confession boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.ornament_type, l.nickname, l.content, l.is_confession, l.created_at
  from public.letters l
  join public.trees t on t.id = l.tree_id
  where coalesce(char_length(p_key) >= 16, false)
    and t.slug = p_slug
    and t.kind = 'professor'
    and t.is_open
    and t.read_key is not null
    and t.read_key = p_key
    and public.is_revealed()
    and not l.hidden
  order by l.created_at;
$$;

revoke all on function public.get_letters_by_read_key(text, text) from public, anon, authenticated, service_role;
grant execute on function public.get_letters_by_read_key(text, text) to anon, authenticated, service_role;

comment on function public.get_letters_by_read_key(text, text) is '교수님 열람 링크: 공개 후 편지 본문 (숨김 제외) — spec.md 4.6';

-- ---------- 관리자 목록에 열람 키를 더한다 (반환 타입이 바뀌므로 새로 만든다) ----------
drop function if exists public.admin_list_special_trees();
create or replace function public.admin_list_special_trees()
returns table (
  id uuid, slug text, title text, owner_name text, kind text, claim_code text,
  letter_count bigint, department text, is_open boolean, like_count bigint, read_key text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return query
    select t.id, t.slug, t.title, t.owner_name, t.kind, t.claim_code,
           (select count(*) from public.letters l where l.tree_id = t.id),
           t.department, t.is_open,
           (select count(*) from public.professor_likes pl where pl.tree_id = t.id),
           t.read_key
    from public.trees t
    where t.kind <> 'user'
    order by t.created_at;
end;
$$;

revoke all on function public.admin_list_special_trees() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_special_trees() to authenticated, service_role;
