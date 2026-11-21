import "server-only";
import { cache } from "react";
import { createClient, createPublicClient, isConfigured } from "@/lib/supabase/server";
import { REVEAL_AT } from "@/lib/constants";

// ---------- 공개 데이터 짧은 캐시 (spec.md 4.5) ----------
// 누가 봐도 같은 값(통계, 공개 시각)만 서버 인스턴스 메모리에 잠깐 보관한다.
// 동시에 들어온 요청은 진행 중인 조회 하나를 함께 기다린다. 실패한 결과는 보관하지 않는다.
const shared = new Map<string, { at: number; value: Promise<unknown> }>();
function sharedCache<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = shared.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  shared.set(key, { at: Date.now(), value });
  value.catch(() => shared.delete(key));
  return value;
}
const STATS_TTL_MS = 60_000;
const REVEAL_AT_TTL_MS = 60_000; // 리허설(S9)에서 reveal_at을 바꾸면 최대 1분 뒤 화면에 반영. 열람 권한은 DB가 즉시 판단

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
  is_open: boolean;
  tree_color: string | null;
  created_at: string;
};

export type OrnamentRow = {
  id: string;
  ornament_type: string;
  nickname: string;
  created_at: string;
};

export type Stats = { tree_count: number; letter_count: number; confession_count: number; today_count: number };

// select('*') 는 컬럼 단위 권한 때문에 실패하므로 명시적으로 나열
// 0003 이 is_open·tree_color 를 더했다 (spec.md 4.6·4.7 · 5.3)
export const TREE_COLUMNS =
  "id, owner_id, slug, title, owner_name, theme, department, kind, description, is_open, tree_color, created_at";

// ---------- 데모 모드 (Supabase 미설정 시 화면 미리보기용) ----------
const DEMO_TREES: Tree[] = [
  {
    id: "demo", owner_id: null, slug: "demo", title: "포스테키안님의 트리", owner_name: "포스테키안",
    theme: "classic", department: "cse", kind: "user", description: null, is_open: true, tree_color: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-prof", owner_id: null, slug: "prof-demo", title: "OO 교수님께 드리는 트리", owner_name: "OO 교수님",
    theme: "chalkboard", department: null, kind: "professor", is_open: true, tree_color: null,
    description: "한 학기 동안 감사했습니다! 교수님께 익명으로 마음을 전해요.",
    created_at: new Date().toISOString(),
  },
];
const DEMO_TYPES = ["ball-red", "jigok", "sock", "star", "coffee", "aplus", "gift", "stairs77", "snowman", "gwamegi", "bell", "dept-cse"];
const DEMO_ORNAMENTS: OrnamentRow[] = DEMO_TYPES.map((t, i) => ({
  id: `demo-${i}`, ornament_type: t, nickname: ["룸메", "실험실 동기", "익명의 산타", "과대", "새터 조원"][i % 5],
  created_at: new Date().toISOString(),
}));
// 데모 편지 본문 (전부 가짜 문구). 주인 화면 미리보기(`?owner=1&dday=0`)에서 편지 모달 확인용.
const DEMO_CONTENTS = [
  "한 학기 동안 같이 살아줘서 고마워. 내년에도 야식 메이트 하자! 메리 크리스마스 🎄",
  "새벽 실험 같이 버텨줘서 고마워요. 덕분에 한 학기를 무사히 마쳤어요.",
  "사실 오래전부터 좋아했어. 크리스마스에 78계단 앞에서 기다릴게.",
  "올해도 고생 많았어! 종강하면 꼭 효자시장에서 밥 한번 먹자 🍚",
];
function demoOrnaments(treeId: string): OrnamentRow[] {
  return treeId === "demo" ? DEMO_ORNAMENTS : DEMO_ORNAMENTS.slice(0, 5).map((o) => ({ ...o, ornament_type: "thanks" }));
}

export const demoMode = !isConfigured;

// ---------- 조회 ----------
// getUser·getTreeBySlug는 React cache()로 한 요청 안에서 한 번만 조회한다
// (generateMetadata와 페이지 본문, getProfile이 같은 결과를 함께 씀). 요청이 끝나면 버려진다.
export const getUser = cache(async () => {
  if (!isConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function getProfile() {
  if (!isConfigured) return null;
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, display_name, is_admin").eq("id", user.id).maybeSingle();
  return data as { id: string; display_name: string | null; is_admin: boolean } | null;
}

export const getTreeBySlug = cache(async (slug: string): Promise<Tree | null> => {
  if (!isConfigured) return DEMO_TREES.find((t) => t.slug === slug) ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("trees").select(TREE_COLUMNS).eq("slug", slug).maybeSingle();
  return data as Tree | null;
});

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
  if (!isConfigured) return demoOrnaments(treeId);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_ornaments", { p_tree_id: treeId });
  return (data ?? []) as OrnamentRow[];
}

export async function getStats(): Promise<Stats> {
  if (!isConfigured) return { tree_count: 128, letter_count: 1024, confession_count: 77, today_count: 42 };
  // 홈 통계는 실시간일 필요가 없어 최대 60초 공유 캐시 (get_stats()가 letters 전체를 셈)
  return sharedCache("stats", STATS_TTL_MS, async () => {
    const { data, error } = await createPublicClient().rpc("get_stats");
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) ?? {};
    return {
      tree_count: Number(row.tree_count ?? 0),
      letter_count: Number(row.letter_count ?? 0),
      confession_count: Number(row.confession_count ?? 0),
      today_count: Number(row.today_count ?? 0),
    };
  }).catch(() => ({ tree_count: 0, letter_count: 0, confession_count: 0, today_count: 0 }));
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
  // 화면 표시용 공개 시각. 모든 페이지가 매번 읽으므로 최대 60초 공유 캐시 (권한 판단은 DB is_revealed())
  return sharedCache("reveal_at", REVEAL_AT_TTL_MS, async () => {
    const { data, error } = await createPublicClient().from("app_config").select("reveal_at").maybeSingle();
    if (error) throw error;
    return data?.reveal_at ? new Date(data.reveal_at) : REVEAL_AT;
  }).catch(() => REVEAL_AT);
}

/** 편지 본문 — RLS 가 "주인 + 공개 이후" 만 허용하므로 그 외에는 빈 배열 */
export async function getLetters(treeId: string) {
  // 데모 모드: 가짜 본문을 돌려준다 (DB 가 없으므로 RLS 와 무관, 실서버에서는 이 줄을 타지 않는다).
  // 세 번째 편지만 고백 편지 — "💘 고백 편지" 라벨 확인용.
  if (!isConfigured) {
    return demoOrnaments(treeId).map((o, i) => ({
      ...o, content: DEMO_CONTENTS[i % DEMO_CONTENTS.length], is_confession: treeId === "demo" && i === 2,
    }));
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("letters")
    .select("id, ornament_type, nickname, content, is_confession, created_at")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: true });
  return (data ?? []) as (OrnamentRow & { content: string; is_confession: boolean })[];
}
