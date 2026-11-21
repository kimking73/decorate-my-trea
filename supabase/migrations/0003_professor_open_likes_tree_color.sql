-- =========================================================
-- 0003 — 교수님 트리 허락(is_open) · 관심(하트, professor_likes) · 트리 색(tree_color)
--   S20, spec.md 4.6 · 4.7 · 5.3
-- 재실행해도 안전하게 작성 (if not exists / create or replace / drop ... if exists).
-- =========================================================

-- ---------- trees: 허락 상태 · 트리 색 ----------
-- is_open = false 는 "허락 대기" — 편지를 받지 않는다. 기본값은 true 라서 기존 트리는 그대로 열려 있다.
alter table public.trees add column if not exists is_open boolean not null default true;
alter table public.trees add column if not exists tree_color text;

alter table public.trees drop constraint if exists trees_tree_color_len;
alter table public.trees add constraint trees_tree_color_len
  check (tree_color is null or char_length(tree_color) between 1 and 30);

comment on column public.trees.is_open is 'false 면 허락 대기 — 편지를 받지 않는다 (spec.md 4.6)';
comment on column public.trees.tree_color is '트리 색 id. null 이면 theme 의 기본색 (spec.md 4.7)';

-- 트리는 누구나 읽으므로 새 컬럼도 select 권한에 넣는다 (lib/data.ts TREE_COLUMNS 와 짝)
grant select (is_open, tree_color) on public.trees to anon, authenticated;

-- 주인이 바꿀 수 있는 것은 tree_color 뿐이다. is_open 은 관리자 함수(admin_set_tree_open)만 바꾼다.
grant update (tree_color) on public.trees to authenticated;

-- ---------- professor_likes ----------
create table if not exists public.professor_likes (
  tree_id uuid not null references public.trees (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tree_id, user_id) -- 1인 1하트
);
create index if not exists professor_likes_tree_idx on public.professor_likes (tree_id);

alter table public.professor_likes enable row level security;
-- 정책을 만들지 않고 권한도 회수한다 → 테이블 직접 조회·변경 불가, RPC 로만 (spec.md 5.3)
revoke all on public.professor_likes from anon, authenticated, service_role;

comment on table public.professor_likes is '교수님 트리 관심(하트). 누가 눌렀는지는 RPC 밖으로 나가지 않는다 (spec.md 4.6)';

-- 교수님 트리에만 달리게 한다 (나중에 다른 경로로 INSERT 해도 지켜진다)
create or replace function public.professor_likes_only_professor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.trees t where t.id = new.tree_id and t.kind = 'professor') then
    raise exception 'not a professor tree' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists professor_likes_kind on public.professor_likes;
create trigger professor_likes_kind before insert on public.professor_likes
  for each row execute function public.professor_likes_only_professor();

-- =========================================================
-- RPC
-- =========================================================

-- 관심순 목록. anon 도 볼 수 있고, 누가 눌렀는지는 돌려주지 않는다 (본인 여부만 liked_by_me).
-- 관심 수는 누구나 볼 수 있지만 누른 사람은 비공개 — auth.uid() 는 본인 판정에만 쓴다.
create or replace function public.list_professors()
returns table (
  id uuid, slug text, owner_name text, department text,
  is_open boolean, like_count bigint, liked_by_me boolean
)
language sql stable security definer set search_path = public as $$
  select t.id, t.slug, t.owner_name, t.department, t.is_open,
         (select count(*) from public.professor_likes l where l.tree_id = t.id),
         coalesce((select true from public.professor_likes l
                    where l.tree_id = t.id and l.user_id = auth.uid()), false)
  from public.trees t
  where t.kind = 'professor'
  order by 6 desc, t.owner_name asc, t.created_at asc; -- 6 = like_count
$$;

revoke all on function public.list_professors() from public, anon, authenticated, service_role;
grant execute on function public.list_professors() to anon, authenticated, service_role;

comment on function public.list_professors() is '교수님 트리 목록 (관심순, 누가 눌렀는지는 제외) — spec.md 4.6';

-- 하트 토글: 로그인한 사람만, 1인 1개, 다시 누르면 취소.
create or replace function public.toggle_professor_like(p_tree_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_liked boolean;
  v_count bigint;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'login_required');
  end if;

  select t.kind into v_kind from public.trees t where t.id = p_tree_id;
  if v_kind is null or v_kind <> 'professor' then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- 같은 사람이 두 번 눌러도 행은 1개: 있으면 지우고(취소), 없으면 넣는다(관심).
  delete from public.professor_likes where tree_id = p_tree_id and user_id = v_uid;
  if found then
    v_liked := false;
  else
    insert into public.professor_likes (tree_id, user_id) values (p_tree_id, v_uid)
    on conflict (tree_id, user_id) do nothing;
    v_liked := true;
  end if;

  select count(*) into v_count from public.professor_likes where tree_id = p_tree_id;
  return jsonb_build_object('liked', v_liked, 'like_count', v_count);
end;
$$;

revoke all on function public.toggle_professor_like(uuid) from public, anon, authenticated, service_role;
grant execute on function public.toggle_professor_like(uuid) to authenticated, service_role;

comment on function public.toggle_professor_like(uuid) is '교수님 트리 하트 토글 (로그인 사용자 1인 1개) — spec.md 4.6';

-- 허락 받은 트리 열기 / 닫기. 관리자만. 트리 주인 권한(grant update)으로는 바꿀 수 없다.
create or replace function public.admin_set_tree_open(p_tree_id uuid, p_open boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  update public.trees set is_open = coalesce(p_open, false) where id = p_tree_id;
  if not found then
    raise exception 'not found';
  end if;
end;
$$;

revoke all on function public.admin_set_tree_open(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_tree_open(uuid, boolean) to authenticated, service_role;

comment on function public.admin_set_tree_open(uuid, boolean) is '관리자: 교수님 트리 허락 상태 바꾸기 — spec.md 4.6';

-- 관리자 목록에 학과·허락 상태·관심 수를 더한다 (반환 타입이 바뀌므로 새로 만든다)
drop function if exists public.admin_list_special_trees();
create or replace function public.admin_list_special_trees()
returns table (
  id uuid, slug text, owner_name text, kind text, claim_code text,
  letter_count bigint, department text, is_open boolean, like_count bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return query
    select t.id, t.slug, t.owner_name, t.kind, t.claim_code,
           (select count(*) from public.letters l where l.tree_id = t.id),
           t.department, t.is_open,
           (select count(*) from public.professor_likes pl where pl.tree_id = t.id)
    from public.trees t
    where t.kind <> 'user'
    order by t.created_at;
end;
$$;

revoke all on function public.admin_list_special_trees() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_special_trees() to authenticated, service_role;

-- =========================================================
-- submit_letter(): 허락 대기(is_open = false) 트리는 "없는 트리"와 같이 거부 (spec.md 4.6)
--   나머지 규칙(작성 제한·한 트랜잭션·service_role 전용)은 0002 와 같다.
-- =========================================================
create or replace function public.submit_letter(
  p_tree_id uuid,
  p_ornament_type text,
  p_nickname text,
  p_content text,
  p_is_confession boolean,
  p_ip_hash text,
  p_client_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_client_per_minute constant integer := 5;   -- 같은 브라우저: 분당 5
  c_client_per_tree_day constant integer := 10; -- 같은 브라우저: 트리당 하루 10
  c_ip_per_minute constant integer := 30;      -- 같은 IP: 분당 30 (캠퍼스 공용 IP 고려)
  v_client_hash text := nullif(p_client_hash, '');
  v_ip_hash text := nullif(p_ip_hash, '');
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_content text := btrim(coalesce(p_content, ''));
  v_id uuid;
  v_count integer;
begin
  -- 없는 트리 · 허락 대기 트리 (잘못된 uuid 는 호출 전에 API 가 400/404 로 거른다)
  if p_tree_id is null
     or not exists (select 1 from public.trees t where t.id = p_tree_id and t.is_open) then
    return jsonb_build_object('ok', false, 'error', 'tree_not_found');
  end if;

  -- 입력은 API 에서 먼저 검증하지만, 함수를 직접 부른 경우에도 DB 제약과 같은 규칙을 지킨다
  if v_content = '' or char_length(v_content) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;
  if p_ornament_type is null or btrim(p_ornament_type) = '' or char_length(p_ornament_type) > 30 then
    return jsonb_build_object('ok', false, 'error', 'invalid_ornament');
  end if;
  if v_nickname = '' then
    v_nickname := '익명의 산타';
  elsif char_length(v_nickname) > 20 then
    v_nickname := left(v_nickname, 20);
  end if;

  -- 같은 브라우저·같은 IP 의 동시 요청을 줄 세운다: 세는 사이에 다른 요청이 끼어들어 제한을 넘지 못하게.
  -- 두 잠금을 항상 같은 순서(브라우저 → IP)로 잡아 교착을 피한다.
  if v_client_hash is not null then
    perform pg_advisory_xact_lock(hashtext('tree:client:' || v_client_hash));
  end if;
  if v_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtext('tree:ip:' || v_ip_hash));
  end if;

  if v_client_hash is not null then
    select count(*) into v_count
    from public.letters l
    where l.client_hash = v_client_hash and l.created_at >= now() - interval '1 minute';
    if v_count >= c_client_per_minute then
      return jsonb_build_object('ok', false, 'error', 'rate_client_minute');
    end if;

    select count(*) into v_count
    from public.letters l
    where l.client_hash = v_client_hash
      and l.tree_id = p_tree_id
      and l.created_at >= now() - interval '1 day';
    if v_count >= c_client_per_tree_day then
      return jsonb_build_object('ok', false, 'error', 'rate_client_tree_day');
    end if;
  end if;

  if v_ip_hash is not null then
    select count(*) into v_count
    from public.letters l
    where l.ip_hash = v_ip_hash and l.created_at >= now() - interval '1 minute';
    if v_count >= c_ip_per_minute then
      return jsonb_build_object('ok', false, 'error', 'rate_ip_minute');
    end if;
  end if;

  insert into public.letters
    (tree_id, ornament_type, nickname, content, is_confession, ip_hash, client_hash)
  values
    (p_tree_id, btrim(p_ornament_type), v_nickname, v_content,
     coalesce(p_is_confession, false), p_ip_hash, p_client_hash)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 브라우저(anon·authenticated)가 직접 호출해 작성 제한을 건너뛸 수 없게 서버 역할에만 실행 권한을 준다.
revoke all on function public.submit_letter(uuid, text, text, text, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_letter(uuid, text, text, text, boolean, text, text)
  to service_role;
