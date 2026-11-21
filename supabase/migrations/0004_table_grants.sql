-- =========================================================
-- 0004 — 테이블 권한 보정 (S3 실서버 검증 중 발견)
--
-- 0001 은 "Supabase 가 public 스키마의 새 테이블에 anon·authenticated·service_role 의
-- 모든 권한을 기본으로 준다"는 전제로 RLS 정책과 컬럼 권한만 적었다. 그런데 이 프로젝트의
-- 실제 기본 권한은 REFERENCES · TRIGGER · TRUNCATE 뿐이라, 정책은 맞는데 테이블 권한이
-- 없어서 다음이 실서버에서 거부되고 있었다 (scripts/test-rls.sql 은 기본 권한을 ALL 로
-- 흉내 내서 통과했다 — 그 구멍도 이번에 같이 막았다).
--
--   * authenticated: trees INSERT  → 트리 만들기가 "트리를 만들지 못했어요" 로 실패
--                    trees DELETE  → 내 트리 지우기 실패
--                    profiles SELECT → /create·/me 의 이름이 비어 보임
--   * anon: app_config SELECT     → 화면의 공개 시각이 상수로 떨어짐
--   * service_role: SELECT        → 운영 스크립트가 테이블을 못 읽음 (앱은 RPC 만 써서 무관)
--
-- 행 제한은 지금처럼 RLS 가 한다. 여기서는 정책이 이미 허용한 동작에 필요한 테이블 권한만 준다.
-- 0003 과 순서는 상관없다 (0003 이 추가하는 컬럼은 테이블 단위 권한이 함께 덮는다).
-- =========================================================

-- 트리 만들기·지우기 (정책: create own tree · delete own tree)
grant insert, delete on public.trees to authenticated;

-- 내 프로필 읽기 (정책: own profile — 자기 행만)
grant select (id, display_name, is_admin, created_at) on public.profiles to authenticated;

-- 공개 시각 (정책: config readable)
grant select (id, reveal_at) on public.app_config to anon, authenticated;

-- 서버(service_role) 조회 — 익명성 컬럼(ip_hash·client_hash)은 어떤 역할에도 주지 않는다
grant select on public.trees to service_role;
grant select (id, display_name, is_admin, created_at) on public.profiles to service_role;
grant select (id, tree_id, ornament_type, nickname, content, is_confession, reported, hidden, created_at)
  on public.letters to service_role;
