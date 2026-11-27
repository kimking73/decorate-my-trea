-- =========================================================
-- 0007 — S21 후속: 관리자 교수님 트리 "정보 수정" RPC + 목록 반환 확장
--   spec.md 3장 · 2.3 · 5.3 — /admin "교수님 목록"의 "정보 수정" 버튼
-- 재실행해도 안전하게 작성 (drop ... if exists / create or replace).
-- 0003 을 다시 돌리면 admin_list_special_trees() 가 옛 모양으로 돌아가므로
-- 0005 → 0006 → 0007 순서로 이어서 돌린다 (0003 이 0005·0006 정의를 덮는다).
-- =========================================================

-- ---------- 1) 교수님·특별 트리 정보 수정 (관리자 전용) ----------
-- 만들 때(0006 admin_create_special_tree)와 같은 입력 규칙을 쓴다. 주소(slug)는 바꾸지 않는다 —
-- 교수님 열람 링크가 /t/<slug>?key=… 라서 주소가 바뀌면 이미 보낸 링크가 깨진다.
-- 일반 학생 트리(kind = 'user')는 대상이 아니다 (admin_set_tree_open 과 같은 이유, spec.md 4.6).
create or replace function public.admin_update_special_tree(
  p_tree_id uuid,
  p_title text,
  p_owner_name text,
  p_theme text,
  p_department text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_title text := btrim(coalesce(p_title, ''));
  v_owner_name text := btrim(coalesce(p_owner_name, ''));
  v_theme text := nullif(btrim(coalesce(p_theme, '')), '');
  v_department text := nullif(btrim(coalesce(p_department, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  select t.kind into v_kind from public.trees t where t.id = p_tree_id;
  if v_kind is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_kind = 'user' then
    return jsonb_build_object('ok', false, 'error', 'not_a_special_tree');
  end if;

  -- 입력 규칙은 0001 의 테이블 제약·0006 의 RPC 와 같다
  if v_title = '' or char_length(v_title) > 30 then
    return jsonb_build_object('ok', false, 'error', 'invalid_title');
  end if;
  if v_owner_name = '' or char_length(v_owner_name) > 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid_owner_name');
  end if;
  if v_theme is null or v_theme not in ('classic', 'snow', 'pink', 'night', 'postech', 'chalkboard') then
    return jsonb_build_object('ok', false, 'error', 'invalid_theme');
  end if;
  if v_department is not null and v_department not in (
    'mueunjae', 'math', 'phys', 'chem', 'life', 'mse', 'me', 'ime', 'ee', 'cse',
    'cheme', 'cite', 'semi', 'ai', 'grad', 'etc'
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_department');
  end if;
  if v_description is not null and char_length(v_description) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_description');
  end if;

  update public.trees
     set title = v_title,
         owner_name = v_owner_name,
         theme = v_theme,
         department = v_department,
         description = v_description
   where id = p_tree_id;

  return jsonb_build_object('ok', true, 'id', p_tree_id);
end;
$$;

revoke all on function public.admin_update_special_tree(uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_update_special_tree(uuid, text, text, text, text, text)
  to authenticated;

comment on function public.admin_update_special_tree(uuid, text, text, text, text, text)
  is '관리자: 교수님·특별 트리 이름·주인 이름·테마·학과·설명 수정 (일반 트리·주소는 바꾸지 않음) — spec.md 3장 · 4.6';

-- ---------- 2) admin_list_special_trees(): 수정 폼이 쓸 theme·description 을 더한다 ----------
-- 반환 컬럼이 늘어나므로 drop → create (0005 가 read_key 를 더할 때와 같은 방법).
-- 관리자 전용 함수라 화면에 나가는 정보는 늘지 않는다.
drop function if exists public.admin_list_special_trees();
create or replace function public.admin_list_special_trees()
returns table (
  id uuid, slug text, title text, owner_name text, kind text, claim_code text,
  letter_count bigint, department text, is_open boolean, like_count bigint, read_key text,
  theme text, description text
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
           t.read_key, t.theme, t.description
    from public.trees t
    where t.kind <> 'user'
    order by t.created_at;
end;
$$;

revoke all on function public.admin_list_special_trees() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_special_trees() to authenticated, service_role;

comment on function public.admin_list_special_trees()
  is '관리자: 교수님·특별 트리 목록 (열람 키·테마·설명 포함, 정보 수정 폼이 씀) — spec.md 2.3 · 5.3';
