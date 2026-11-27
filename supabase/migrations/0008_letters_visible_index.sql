-- =========================================================
-- 0008 — S17: 0시 조회 경량화용 부분 인덱스 (spec.md 4.5 · 5.3)
--
-- 0시 트리 페이지가 읽는 편지는 모두 "트리 하나 + 숨김 아님" 이다.
--   * get_ornaments()                         — 장식 목록 (본문 제외)
--   * get_letters_by_read_key()               — 교수님 열람 링크
--   * 주인 화면의 letters 조회 (RLS "owner reads after reveal")
-- 0001 의 letters_tree_idx (tree_id, created_at) 는 숨김·신고된 편지까지 담는다.
-- 신고로 숨긴 편지가 쌓이면 그만큼 읽었다 버리는 행이 늘어나므로, 숨김을 뺀
-- 부분 인덱스를 따로 둔다. (정렬은 인덱스 순서를 그대로 쓴다.)
--
-- 재실행해도 안전하다 (if not exists). 행을 바꾸지 않고 읽기 경로만 빠르게 한다.
-- 편지가 적은 지금은 차이가 작고, 12/25 0시에 트리별 조회가 몰릴 때 효과가 난다.
-- =========================================================

create index if not exists letters_visible_tree_idx
  on public.letters (tree_id, created_at)
  where not hidden;

comment on index public.letters_visible_tree_idx
  is '트리별 숨김 제외 편지 목록 — 0시 열람 경로(get_ornaments·get_letters_by_read_key·주인 조회). spec.md 4.5';
