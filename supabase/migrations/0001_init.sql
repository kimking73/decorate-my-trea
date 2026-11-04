-- =========================================================
-- POSTECH 크리스마스 트리 — 초기 스키마
-- 핵심: 편지 본문(content)은 "트리 주인" + "공개 시각 이후"에만 DB 레벨에서 읽을 수 있다.
-- =========================================================

-- ---------- 설정 ----------
create table if not exists public.app_config (
  id boolean primary key default true check (id), -- 단일 행
  reveal_at timestamptz not null default '2026-12-25 00:00:00+09'
);
insert into public.app_config (id) values (true) on conflict do nothing;

create or replace function public.is_revealed()
returns boolean language sql stable security definer set search_path = public as $$
  select now() >= (select reveal_at from public.app_config limit 1);
$$;

-- ---------- 프로필 ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'nickname', '산타')
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- 트리 ----------
create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{4,40}$'),
  title text not null check (char_length(title) between 1 and 30),
  owner_name text not null default '산타' check (char_length(owner_name) between 1 and 20),
  theme text not null default 'classic',
  department text,
  kind text not null default 'user' check (kind in ('user', 'professor', 'special')),
  description text check (char_length(description) <= 200),
  show_in_ranking boolean not null default true,
  claim_code text unique,
  created_at timestamptz not null default now()
);
-- 일반 유저는 트리 1개
create unique index if not exists trees_one_per_user on public.trees (owner_id) where kind = 'user';

-- ---------- 편지 ----------
create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees (id) on delete cascade,
  ornament_type text not null check (char_length(ornament_type) <= 30),
  nickname text not null default '익명의 산타' check (char_length(nickname) between 1 and 20),
  content text not null check (char_length(content) between 1 and 1000),
  is_confession boolean not null default false,
  ip_hash text,
  reported boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists letters_tree_idx on public.letters (tree_id, created_at);
create index if not exists letters_ip_idx on public.letters (ip_hash, created_at);

-- =========================================================
-- RLS
-- =========================================================
alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.trees enable row level security;
alter table public.letters enable row level security;

drop policy if exists "config readable" on public.app_config;
create policy "config readable" on public.app_config for select using (true);

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (id = auth.uid());
-- is_admin 은 유저가 바꿀 수 없도록 컬럼 단위 권한
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- 트리는 누구나 볼 수 있음 (claim_code 컬럼은 숨김)
drop policy if exists "trees readable" on public.trees;
create policy "trees readable" on public.trees for select using (true);
revoke select on public.trees from anon, authenticated;
grant select (id, owner_id, slug, title, owner_name, theme, department, kind, description,
              show_in_ranking, created_at) on public.trees to anon, authenticated;

drop policy if exists "create own tree" on public.trees;
create policy "create own tree" on public.trees for insert to authenticated
  with check (owner_id = auth.uid() and (kind = 'user' or public.is_admin()));

drop policy if exists "update own tree" on public.trees;
create policy "update own tree" on public.trees for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
revoke update on public.trees from anon, authenticated;
grant update (title, owner_name, theme, department, description, show_in_ranking)
  on public.trees to authenticated;

drop policy if exists "delete own tree" on public.trees;
create policy "delete own tree" on public.trees for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- 편지 본문: 트리 주인 + 공개 시각 이후 (숨김 처리된 편지 제외). 관리자는 신고된 편지만 검토 가능.
drop policy if exists "owner reads after reveal" on public.letters;
create policy "owner reads after reveal" on public.letters for select to authenticated
  using (
    (not hidden and public.is_revealed()
      and exists (select 1 from public.trees t where t.id = tree_id and t.owner_id = auth.uid()))
    or (reported and public.is_admin())
  );
-- INSERT/UPDATE/DELETE 는 정책 없음 → 클라이언트 직접 불가 (서버 라우트가 service role 로 삽입)
revoke insert, update, delete on public.letters from anon, authenticated;
revoke select on public.letters from anon;
-- ip_hash 는 누구에게도 노출하지 않음
revoke select on public.letters from authenticated;
grant select (id, tree_id, ornament_type, nickname, content, is_confession, reported, hidden, created_at)
  on public.letters to authenticated;

-- =========================================================
-- RPC (본문 없이 장식 정보만 / 집계만 반환)
-- =========================================================

-- 트리에 달린 장식 목록 (본문 제외). 고백 편지는 공개 전까지 닉네임을 가린다.
create or replace function public.get_ornaments(p_tree_id uuid)
returns table (id uuid, ornament_type text, nickname text, is_confession boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.ornament_type,
         case when l.is_confession and not public.is_revealed() then '???' else l.nickname end,
         l.is_confession, l.created_at
  from public.letters l
  where l.tree_id = p_tree_id and not l.hidden
  order by l.created_at asc;
$$;

create or replace function public.get_stats()
returns table (tree_count bigint, letter_count bigint, confession_count bigint, today_count bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.trees),
    (select count(*) from public.letters where not hidden),
    (select count(*) from public.letters where is_confession and not hidden),
    (select count(*) from public.letters
      where not hidden and created_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
$$;

create or replace function public.get_top_trees(p_limit int default 5)
returns table (slug text, title text, owner_name text, kind text, letter_count bigint)
language sql stable security definer set search_path = public as $$
  select t.slug, t.title, t.owner_name, t.kind, count(l.id) as letter_count
  from public.trees t
  join public.letters l on l.tree_id = t.id and not l.hidden
  where t.show_in_ranking and t.kind = 'user'
  group by t.id
  order by letter_count desc, min(l.created_at) asc
  limit least(greatest(p_limit, 1), 20);
$$;

-- 트리 주인이 편지를 신고(숨김) — 공개 후에만 의미 있음
create or replace function public.report_letter(p_letter_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.letters l set reported = true, hidden = true
  where l.id = p_letter_id
    and exists (select 1 from public.trees t where t.id = l.tree_id and t.owner_id = auth.uid());
  if not found then raise exception 'not allowed'; end if;
end;
$$;

-- 관리자: 신고 편지 처리 (restore=true 면 복구, false 면 삭제)
create or replace function public.admin_resolve_report(p_letter_id uuid, p_restore boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_restore then
    update public.letters set reported = false, hidden = false where id = p_letter_id;
  else
    delete from public.letters where id = p_letter_id;
  end if;
end;
$$;

-- 관리자: 특별 트리(교수님 트리 등)용 소유권 이전 코드 발급
create or replace function public.admin_set_claim_code(p_tree_id uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.trees set claim_code = p_code where id = p_tree_id and kind <> 'user';
end;
$$;

-- 교수님 등이 코드를 입력해 특별 트리 소유권을 가져감
create or replace function public.claim_tree(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  update public.trees set owner_id = auth.uid(), claim_code = null
  where claim_code = p_code and kind <> 'user'
  returning slug into v_slug;
  if v_slug is null then raise exception 'invalid code'; end if;
  return v_slug;
end;
$$;

-- 관리자: 특별 트리 목록 + 초대 코드
create or replace function public.admin_list_special_trees()
returns table (id uuid, slug text, title text, owner_name text, kind text, claim_code text, letter_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select t.id, t.slug, t.title, t.owner_name, t.kind, t.claim_code,
           (select count(*) from public.letters l where l.tree_id = t.id)
    from public.trees t where t.kind <> 'user' order by t.created_at;
end;
$$;

revoke all on function public.admin_list_special_trees() from anon, public;
grant execute on function public.admin_list_special_trees() to authenticated;

revoke all on function public.report_letter(uuid), public.admin_resolve_report(uuid, boolean),
  public.admin_set_claim_code(uuid, text), public.claim_tree(text) from anon, public;
grant execute on function public.report_letter(uuid), public.admin_resolve_report(uuid, boolean),
  public.admin_set_claim_code(uuid, text), public.claim_tree(text) to authenticated;
grant execute on function public.get_ornaments(uuid), public.get_stats(), public.get_top_trees(int),
  public.is_revealed() to anon, authenticated;
