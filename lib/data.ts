import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
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

// ---------- 데모 로그인 (spec.md 4.2, 데모 모드 전용) ----------
// 와이어프레임 전체 화면을 데모 주소에서 보여 주기 위한 가짜 로그인. 이 브라우저 쿠키에만 저장한다.
// Supabase가 설정된 서버(isConfigured)에서는 읽지도 쓰지도 않는다.
export const DEMO_SESSION_COOKIE = "demo_session";
export const DEMO_USER_ID = "demo-user";
export type DemoSession = { tree?: { name: string; color: string | null; theme: string }; likes: string[] };
// 데모 로그인하면 와이어프레임 /me처럼 트리가 있는 상태로 시작한다 (트리 없음 화면은 로그아웃 후 /create 전에는 못 봄 — 4.2)
export const DEFAULT_DEMO_SESSION: DemoSession = { tree: { name: "포닉스", color: null, theme: "classic" }, likes: [] };
/** 로그인이 필요한 화면에서 로그인 안 했을 때 갈 곳. 데모는 바로 데모 로그인 (spec.md 4.2) */
export function loginPath(next: string) {
  return `${isConfigured ? "/login" : "/auth/demo"}?next=${encodeURIComponent(next)}`;
}

export async function readDemoSession(): Promise<DemoSession | null> {
  if (isConfigured) return null;
  const raw = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const t = v?.tree;
    return {
      tree: t && typeof t.name === "string"
        ? { name: t.name.slice(0, 20), color: typeof t.color === "string" ? t.color : null, theme: typeof t.theme === "string" ? t.theme : "classic" }
        : undefined,
      likes: Array.isArray(v?.likes) ? v.likes.filter((x: unknown): x is string => typeof x === "string").slice(0, 20) : [],
    };
  } catch {
    return null;
  }
}

// 데모 로그인 후 만든 "내 트리"는 데모 트리(/t/demo)를 이 브라우저에서만 내 것으로 보여 준다
function demoMyTree(s: DemoSession): Tree | null {
  if (!s.tree) return null;
  return {
    ...DEMO_TREES[0], owner_id: DEMO_USER_ID, owner_name: s.tree.name, title: `${s.tree.name}님의 트리`,
    theme: s.tree.theme, tree_color: s.tree.color,
  };
}

// 교수님 목록 (데모). prof-demo만 트리가 열려 있고 나머지는 허락 대기라 /t/<slug>는 "없는 트리"
const DEMO_PROFESSORS: (Omit<ProfessorRow, "liked_by_me"> & { letter_count: number })[] = [
  { id: "demo-prof", slug: "prof-demo", owner_name: "OO 교수님", department: "cse", is_open: true, like_count: 128, letter_count: 5 },
  { id: "demo-prof-2", slug: "prof-demo-2", owner_name: "이OO 교수님", department: "phys", is_open: false, like_count: 97, letter_count: 0 },
  { id: "demo-prof-3", slug: "prof-demo-3", owner_name: "박OO 교수님", department: "chem", is_open: false, like_count: 64, letter_count: 0 },
  { id: "demo-prof-4", slug: "prof-demo-4", owner_name: "최OO 교수님", department: "math", is_open: false, like_count: 41, letter_count: 0 },
  { id: "demo-prof-5", slug: "prof-demo-5", owner_name: "정OO 교수님", department: "me", is_open: false, like_count: 23, letter_count: 0 },
];
export function demoProfessorBaseCount(id: string): number | null {
  return DEMO_PROFESSORS.find((p) => p.id === id)?.like_count ?? null;
}

// ---------- 조회 ----------
// getUser·getTreeBySlug는 React cache()로 한 요청 안에서 한 번만 조회한다
// (generateMetadata와 페이지 본문, getProfile이 같은 결과를 함께 씀). 요청이 끝나면 버려진다.
export const getUser = cache(async (): Promise<User | null> => {
  if (!isConfigured) return (await readDemoSession()) ? ({ id: DEMO_USER_ID } as User) : null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function getProfile() {
  // 데모 로그인은 관리자 화면까지 보이도록 관리자로 취급한다 (저장은 되지 않음, spec.md 4.2)
  if (!isConfigured) return (await readDemoSession()) ? { id: DEMO_USER_ID, display_name: null, is_admin: true } : null;
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, display_name, is_admin").eq("id", user.id).maybeSingle();
  return data as { id: string; display_name: string | null; is_admin: boolean } | null;
}

export const getTreeBySlug = cache(async (slug: string): Promise<Tree | null> => {
  if (!isConfigured) {
    const s = slug === "demo" ? await readDemoSession() : null;
    return (s && demoMyTree(s)) || (DEMO_TREES.find((t) => t.slug === slug) ?? null);
  }
  const supabase = await createClient();
  const { data } = await supabase.from("trees").select(TREE_COLUMNS).eq("slug", slug).maybeSingle();
  return data as Tree | null;
});

export async function getMyTree(userId: string): Promise<Tree | null> {
  if (!isConfigured) {
    const s = userId === DEMO_USER_ID ? await readDemoSession() : null;
    return s ? demoMyTree(s) : null;
  }
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

export type LetterRow = OrnamentRow & { content: string; is_confession: boolean };

/** 편지 본문 — RLS 가 "주인 + 공개 이후" 만 허용하므로 그 외에는 빈 배열 */
export async function getLetters(treeId: string): Promise<LetterRow[]> {
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
  return (data ?? []) as LetterRow[];
}

// ---------- 교수님 비밀 열람 링크 (spec.md 4.6, T9) ----------
// 데모 모드에서만 쓰는 열람 키. 실서버(isConfigured)에서는 이 값을 보지 않는다.
const DEMO_READ_KEY = "demo";

/**
 * 열람 링크(`/t/<slug>?key=…`)로 교수님 트리 편지 읽기.
 * `null` = 키가 틀림(방문자 화면) · 배열 = 키가 맞음. 본문은 DB가 공개 이후(is_revealed())에만 돌려주므로
 * 공개 전이나 편지가 없으면 `[]`. 조회 실패는 throw (오류 계약, spec.md 2.3).
 */
export async function getLettersByReadKey(slug: string, key: string): Promise<LetterRow[] | null> {
  if (!key) return null;
  // 데모: 가짜 편지를 돌려주고, 공개 전/후 구분은 페이지가 ?dday 로 흉내 낸다 (DB 와 무관)
  if (!isConfigured) {
    const tree = DEMO_TREES.find((t) => t.slug === slug && t.kind === "professor");
    return tree && key === DEMO_READ_KEY ? getLetters(tree.id) : null;
  }
  const supabase = await createClient();
  const [valid, letters] = await Promise.all([
    supabase.rpc("check_read_key", { p_slug: slug, p_key: key }),
    supabase.rpc("get_letters_by_read_key", { p_slug: slug, p_key: key }),
  ]);
  if (valid.error) throw valid.error;
  if (letters.error) throw letters.error;
  if (valid.data !== true) return null;
  return (letters.data ?? []) as LetterRow[];
}

// ---------- 교수님 목록·관리자 (spec.md 2.3, 4.6) ----------
// 오류 계약(spec.md 2.3): 없으면 빈 배열, 조회 실패는 throw → app/error.tsx
export type ProfessorRow = {
  id: string; slug: string; owner_name: string; department: string | null;
  is_open: boolean; like_count: number; liked_by_me: boolean;
};

/** 관심순 교수님 목록. liked_by_me는 로그인했을 때만 의미가 있다 (누가 눌렀는지는 돌려주지 않음) */
export async function getProfessors(): Promise<ProfessorRow[]> {
  if (!isConfigured) {
    const likes = (await readDemoSession())?.likes ?? [];
    return DEMO_PROFESSORS
      .map((p) => ({
        id: p.id, slug: p.slug, owner_name: p.owner_name, department: p.department, is_open: p.is_open,
        like_count: p.like_count + (likes.includes(p.id) ? 1 : 0), liked_by_me: likes.includes(p.id),
      }))
      .sort((a, b) => b.like_count - a.like_count || a.owner_name.localeCompare(b.owner_name, "ko"));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_professors");
  if (error) throw error;
  return ((data ?? []) as ProfessorRow[]).map((p) => ({ ...p, like_count: Number(p.like_count), liked_by_me: !!p.liked_by_me }));
}

export type AdminTreeRow = {
  id: string; slug: string; title: string; owner_name: string; kind: string;
  letter_count: number; department: string | null; is_open: boolean; like_count: number;
  /** 교수님 열람 키 (없으면 null). 관리자 화면에서 링크를 만들 때만 쓴다 (spec.md 4.6) */
  read_key: string | null;
};

/** /admin 교수님 목록 탭 (관리자만, DB admin_list_special_trees가 is_admin() 확인) */
export async function getAdminSpecialTrees(): Promise<AdminTreeRow[]> {
  if (!isConfigured) {
    const likes = (await readDemoSession())?.likes ?? [];
    return DEMO_PROFESSORS.map((p) => ({
      ...p, title: `${p.owner_name}께 드리는 트리`, kind: "professor", like_count: p.like_count + (likes.includes(p.id) ? 1 : 0),
      read_key: p.slug === "prof-demo" ? DEMO_READ_KEY : null,
    }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_special_trees");
  if (error) throw error;
  return ((data ?? []) as AdminTreeRow[]).map((t) => ({ ...t, letter_count: Number(t.letter_count), like_count: Number(t.like_count ?? 0), read_key: t.read_key ?? null }));
}

export type ReportedLetter = { id: string; content: string; created_at: string; tree_title: string | null };

/** 신고된 편지 (관리자만, RLS) */
export async function getReportedLetters(): Promise<ReportedLetter[]> {
  if (!isConfigured) {
    if (!(await readDemoSession())) return [];
    return [
      { id: "demo-report-1", content: "(데모) 신고된 편지 예시예요. 복구하거나 삭제할 수 있어요.", created_at: new Date().toISOString(), tree_title: "포스테키안님의 트리" },
    ];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("letters").select("id, content, created_at, trees(title)").eq("reported", true).order("created_at");
  if (error) throw error;
  return ((data ?? []) as unknown as { id: string; content: string; created_at: string; trees: { title: string } | null }[])
    .map((l) => ({ id: l.id, content: l.content, created_at: l.created_at, tree_title: l.trees?.title ?? null }));
}
