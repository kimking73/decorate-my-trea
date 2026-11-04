import "server-only";
import { createClient, isConfigured } from "@/lib/supabase/server";
import { REVEAL_AT } from "@/lib/constants";

export type Tree = {
  id: string;
  owner_id: string | null;
  slug: string;
  title: string;
  owner_name: string;
  theme: string;
  department: string | null;
  kind: "user" | "professor" | "special";
  description: string | null;
  show_in_ranking: boolean;
  created_at: string;
};

export type OrnamentRow = {
  id: string;
  ornament_type: string;
  nickname: string;
  is_confession: boolean;
  created_at: string;
};

export type Stats = { tree_count: number; letter_count: number; confession_count: number; today_count: number };
export type TopTree = { slug: string; title: string; owner_name: string; kind: string; letter_count: number };

// select('*') 는 컬럼 단위 권한 때문에 실패하므로 명시적으로 나열
export const TREE_COLUMNS =
  "id, owner_id, slug, title, owner_name, theme, department, kind, description, show_in_ranking, created_at";

// ---------- 데모 모드 (Supabase 미설정 시 화면 미리보기용) ----------
const DEMO_TREES: Tree[] = [
  {
    id: "demo", owner_id: null, slug: "demo", title: "지곡동 산타의 트리", owner_name: "포스테키안",
    theme: "classic", department: "cse", kind: "user", description: null, show_in_ranking: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-prof", owner_id: null, slug: "prof-demo", title: "OO 교수님께 드리는 트리", owner_name: "OO 교수님",
    theme: "chalkboard", department: null, kind: "professor",
    description: "한 학기 동안 감사했습니다! 교수님께 익명으로 마음을 전해요.", show_in_ranking: false,
    created_at: new Date().toISOString(),
  },
];
const DEMO_TYPES = ["ball-red", "jigok", "confession", "star", "coffee", "aplus", "gift", "stairs77", "snowman", "gwamegi", "confession", "dept-cse"];
const DEMO_ORNAMENTS: OrnamentRow[] = DEMO_TYPES.map((t, i) => ({
  id: `demo-${i}`, ornament_type: t, nickname: t === "confession" ? "???" : ["룸메", "실험실 동기", "익명의 산타", "과대", "새터 조원"][i % 5],
  is_confession: t === "confession", created_at: new Date().toISOString(),
}));

export const demoMode = !isConfigured;

// ---------- 조회 ----------
export async function getUser() {
  if (!isConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getProfile() {
  if (!isConfigured) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("id, display_name, is_admin").eq("id", auth.user.id).maybeSingle();
  return data as { id: string; display_name: string | null; is_admin: boolean } | null;
}

export async function getTreeBySlug(slug: string): Promise<Tree | null> {
  if (!isConfigured) return DEMO_TREES.find((t) => t.slug === slug) ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("trees").select(TREE_COLUMNS).eq("slug", slug).maybeSingle();
  return data as Tree | null;
}

export async function getMyTree(userId: string): Promise<Tree | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trees").select(TREE_COLUMNS).eq("owner_id", userId).eq("kind", "user").maybeSingle();
  return data as Tree | null;
}

export async function getOwnedSpecialTrees(userId: string): Promise<Tree[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trees").select(TREE_COLUMNS).eq("owner_id", userId).neq("kind", "user");
  return (data ?? []) as Tree[];
}

export async function getOrnaments(treeId: string): Promise<OrnamentRow[]> {
  if (!isConfigured) return treeId === "demo" ? DEMO_ORNAMENTS : DEMO_ORNAMENTS.slice(0, 5).map((o) => ({ ...o, ornament_type: "thanks" }));
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_ornaments", { p_tree_id: treeId });
  return (data ?? []) as OrnamentRow[];
}

export async function getStats(): Promise<Stats> {
  if (!isConfigured) return { tree_count: 128, letter_count: 1024, confession_count: 77, today_count: 42 };
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_stats");
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  return {
    tree_count: Number(row.tree_count ?? 0),
    letter_count: Number(row.letter_count ?? 0),
    confession_count: Number(row.confession_count ?? 0),
    today_count: Number(row.today_count ?? 0),
  };
}

export async function getTopTrees(): Promise<TopTree[]> {
  if (!isConfigured) return [{ slug: "demo", title: "지곡동 산타의 트리", owner_name: "포스테키안", kind: "user", letter_count: 12 }];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_top_trees", { p_limit: 5 });
  return ((data ?? []) as TopTree[]).map((t) => ({ ...t, letter_count: Number(t.letter_count) }));
}

export async function getSpecialTrees(): Promise<Tree[]> {
  if (!isConfigured) return DEMO_TREES.filter((t) => t.kind !== "user");
  const supabase = await createClient();
  const { data } = await supabase
    .from("trees").select(TREE_COLUMNS).neq("kind", "user").order("created_at", { ascending: true });
  return (data ?? []) as Tree[];
}

export async function getRevealAt(): Promise<Date> {
  if (!isConfigured) return REVEAL_AT;
  const supabase = await createClient();
  const { data } = await supabase.from("app_config").select("reveal_at").maybeSingle();
  return data?.reveal_at ? new Date(data.reveal_at) : REVEAL_AT;
}

/** 편지 본문 — RLS 가 "주인 + 공개 이후" 만 허용하므로 그 외에는 빈 배열 */
export async function getLetters(treeId: string) {
  if (!isConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("letters")
    .select("id, ornament_type, nickname, content, is_confession, created_at")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: true });
  return (data ?? []) as (OrnamentRow & { content: string })[];
}
