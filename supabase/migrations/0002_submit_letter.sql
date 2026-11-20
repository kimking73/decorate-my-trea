-- =========================================================
-- 0002 — 편지 저장을 DB 함수 한 트랜잭션으로 (S11, spec.md 4.4·5.3)
--   * letters.client_hash 추가 — 브라우저 ID(anon_id 쿠키)의 솔트 해시
--   * submit_letter(): 트리 확인 · 작성 제한 확인 · INSERT 를 한 트랜잭션에서
--   * service_role 만 실행 가능 (anon·authenticated 는 호출 실패)
-- 재실행해도 안전하게 작성 (if not exists / create or replace).
-- =========================================================

-- ---------- 컬럼 ----------
alter table public.letters add column if not exists client_hash text;
create index if not exists letters_client_idx on public.letters (client_hash, created_at);

-- ---------- 제출 ----------
-- 반환값은 jsonb: { "ok": true, "id": <uuid> } 또는 { "ok": false, "error": <코드> }
--   error 코드: tree_not_found · invalid_content · invalid_ornament
--               rate_client_minute · rate_client_tree_day · rate_ip_minute
--   제한 초과는 예외가 아니라 값으로 돌려준다 (API 가 429 로 바꾼다).
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
  -- 존재하지 않는 트리 (잘못된 uuid 는 호출 전에 API 가 400/404 로 거른다)
  if p_tree_id is null or not exists (select 1 from public.trees t where t.id = p_tree_id) then
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

comment on function public.submit_letter(uuid, text, text, text, boolean, text, text)
  is '익명 편지 제출 — 트리 확인·작성 제한·저장을 한 트랜잭션으로 (service_role 전용, spec.md 4.4·5.3)';
