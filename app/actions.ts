"use server";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEPARTMENTS, isTreeColor, THEMES, USER_THEME_IDS, type ThemeId } from "@/lib/constants";
import {
  DEFAULT_DEMO_SESSION, DEMO_SESSION_COOKIE, demoMode, demoProfessorBaseCount, loginPath, readDemoSession, type DemoSession,
} from "@/lib/data";

function randomSlug(len = 8) {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(len), (b) => abc[b % abc.length]).join("");
}

// 관리자 특별 트리용
function readSpecialTreeForm(fd: FormData) {
  const title = String(fd.get("title") ?? "").trim().slice(0, 30);
  const owner_name = String(fd.get("owner_name") ?? "").trim().slice(0, 20);
  const themeRaw = String(fd.get("theme") ?? "chalkboard") as ThemeId;
  const theme = Object.prototype.hasOwnProperty.call(THEMES, themeRaw) ? themeRaw : "chalkboard"; // `in`은 prototype 키도 통과
  const description = String(fd.get("description") ?? "").trim().slice(0, 200) || null;
  const deptRaw = String(fd.get("department") ?? "");
  const department = DEPARTMENTS.some((d) => d.id === deptRaw) ? deptRaw : null;
  return { title, owner_name, theme, description, department };
}

export type FormState = { error?: string } | undefined;

// ---------- 데모 로그인 (spec.md 4.2, 데모 모드 전용) ----------
async function writeDemoSession(s: DemoSession) {
  (await cookies()).set(DEMO_SESSION_COOKIE, JSON.stringify(s), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}

// /login·/auth/callback과 같은 next 검사 (spec.md 5.1): 같은 사이트 경로만
function safeNext(next: FormDataEntryValue | null) {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/me";
}

export async function demoSignIn(fd: FormData) {
  if (!demoMode) redirect("/login");
  await writeDemoSession((await readDemoSession()) ?? DEFAULT_DEMO_SESSION);
  redirect(safeNext(fd.get("next")));
}

export async function demoSignOut() {
  if (demoMode) (await cookies()).delete(DEMO_SESSION_COOKIE);
  redirect("/");
}

export async function saveMyTree(_: FormState, fd: FormData): Promise<FormState> {
  if (demoMode) {
    const s = await readDemoSession();
    if (!s) redirect("/login?next=/create");
    const name = String(fd.get("owner_name") ?? "").trim().slice(0, 20);
    if (!name) return { error: "이름을 입력해주세요." };
    await writeDemoSession({ ...s, tree: { name, color: s.tree?.color ?? null, theme: s.tree?.theme ?? "classic" } });
    redirect(s.tree ? "/me?toast=renamed" : "/t/demo");
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/create");

  const owner_name = String(fd.get("owner_name") ?? "").trim().slice(0, 20);
  if (!owner_name) return { error: "이름을 입력해주세요." };
  const title = `${owner_name}님의 트리`.slice(0, 30);

  const { data: existing } = await supabase
    .from("trees").select("id, slug").eq("owner_id", user.id).eq("kind", "user").maybeSingle();

  if (existing) {
    const { error } = await supabase.from("trees").update({ title, owner_name }).eq("id", existing.id);
    if (error) return { error: "저장에 실패했어요." };
    revalidatePath(`/t/${existing.slug}`);
    redirect("/me?toast=renamed"); // 이름 바꾸기는 내 페이지로 (spec.md 2.3)
  }

  for (let i = 0; i < 3; i++) {
    const slug = randomSlug();
    const { error } = await supabase.from("trees").insert({
      owner_id: user.id, slug, kind: "user", title, owner_name, theme: "classic",
    });
    if (!error) redirect(`/t/${slug}`);
    if (error.code !== "23505") return { error: "트리를 만들지 못했어요." };
  }
  return { error: "잠시 후 다시 시도해주세요." };
}

export async function claimTree(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const code = String(fd.get("code") ?? "").trim();
  if (!code) return { error: "코드를 입력해주세요." };
  const { data, error } = await supabase.rpc("claim_tree", { p_code: code });
  if (error || !data) return { error: "유효하지 않은 코드예요." };
  redirect(`/t/${data}`);
}

// ---------- 관리자 ----------
// admin_create_special_tree(0006)가 돌려주는 오류 코드 → 사용자 문구 (spec.md 2.3: DB 문장을 그대로 보이지 않는다)
const CREATE_ERRORS: Record<string, string> = {
  not_allowed: "관리자만 만들 수 있어요.",
  invalid_kind: "만들 수 없는 트리 종류예요.",
  invalid_title: "트리 이름을 입력해주세요.",
  invalid_owner_name: "주인 이름을 입력해주세요.",
  invalid_theme: "테마를 다시 골라 주세요.",
  invalid_department: "학과를 다시 골라 주세요.",
  invalid_description: "설명은 200자까지 쓸 수 있어요.",
  invalid_slug: "주소를 다시 만들어 주세요.",
  slug_taken: "이미 쓰는 주소예요. 주소를 바꿔 주세요.",
};
const CREATE_FAILED = "트리를 만들지 못했어요. 잠시 후 다시 시도해 주세요.";

export async function adminCreateSpecialTree(_: FormState, fd: FormData): Promise<FormState> {
  if (demoMode) return { error: "데모라 저장되지 않아요. 실서버에서는 허락 대기 트리로 만들어져요." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };
  const v = readSpecialTreeForm(fd);
  const kind = fd.get("kind") === "special" ? "special" : "professor";
  if (!v.title || !v.owner_name) return { error: "제목과 이름을 입력해주세요." };
  const slugRaw = String(fd.get("slug") ?? "").trim().toLowerCase();
  const fixedSlug = /^[a-z0-9-]{4,40}$/.test(slugRaw) ? slugRaw : null;

  // 0006 의 RPC 가 is_open = false(허락 대기)로 만들고, 만든 관리자를 트리 주인으로 둔다 (spec.md 3장·4.6).
  // 주소가 겹칠 때만(자동으로 만든 주소) 다른 주소로 다시 시도한다.
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.rpc("admin_create_special_tree", {
      p_title: v.title, p_owner_name: v.owner_name, p_slug: fixedSlug ?? `prof-${randomSlug(6)}`,
      p_kind: kind, p_theme: v.theme, p_department: v.department, p_description: v.description,
    });
    if (error) return { error: CREATE_FAILED };
    const r = (data ?? {}) as { ok?: boolean; error?: string };
    if (r.ok) {
      revalidatePath("/admin");
      revalidatePath("/");
      revalidatePath("/professors");
      redirect("/admin?tab=list&toast=created"); // 목록 탭에서 허락 대기로 보인다 (spec.md 2.3)
    }
    if (r.error !== "slug_taken" || fixedSlug) return { error: CREATE_ERRORS[r.error ?? ""] ?? CREATE_FAILED };
  }
  return { error: "잠시 후 다시 시도해주세요." };
}

export async function adminIssueClaimCode(fd: FormData) {
  const supabase = await createClient();
  const treeId = String(fd.get("tree_id"));
  await supabase.rpc("admin_set_claim_code", { p_tree_id: treeId, p_code: randomSlug(10) });
  revalidatePath("/admin");
}

export async function adminResolve(fd: FormData) {
  const restore = fd.get("restore") === "1";
  const back = (toast: string) => `/admin?tab=reports&toast=${toast}`;
  if (demoMode) redirect(back("demo"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(loginPath("/admin?tab=reports"));
  // 결과를 화면에 알려 준다 (spec.md 5.1) — 실패를 조용히 넘기지 않는다
  const { error } = await supabase.rpc("admin_resolve_report", {
    p_letter_id: String(fd.get("letter_id")), p_restore: restore,
  });
  revalidatePath("/admin");
  redirect(back(error ? "failed" : restore ? "restored" : "deleted"));
}

// ---------- 교수님 하트 (spec.md 4.6) ----------
type LikeError = { error: string; code?: "login_required" };
const LIKE_LOGIN_REQUIRED: LikeError = { error: "로그인하면 하트를 보낼 수 있어요.", code: "login_required" };

export async function toggleProfessorLike(treeId: string): Promise<{ liked: boolean; count: number } | LikeError> {
  if (demoMode) {
    const s = await readDemoSession();
    const base = demoProfessorBaseCount(treeId);
    if (!s) return LIKE_LOGIN_REQUIRED;
    if (base === null) return { error: "교수님을 찾을 수 없어요." };
    const liked = !s.likes.includes(treeId);
    await writeDemoSession({ ...s, likes: liked ? [...s.likes, treeId] : s.likes.filter((x) => x !== treeId) });
    return { liked, count: base + (liked ? 1 : 0) };
  }
  const supabase = await createClient();
  // 로그인 확인을 따로 하지 않고 RPC 한 번으로 끝낸다 (하트가 몰릴 때 Auth 왕복을 줄임).
  // 세션이 없거나 끝난 요청은 anon으로 가서 실행 권한이 없으므로(0003: authenticated만) 42501,
  // 만료된 토큰이 그대로 가면 PostgREST가 PGRST301/PGRST303 → 둘 다 로그인 필요
  const { data, error } = await supabase.rpc("toggle_professor_like", { p_tree_id: treeId });
  if (error && ["42501", "PGRST301", "PGRST303"].includes(error.code)) return LIKE_LOGIN_REQUIRED;
  if (error) return { error: "잠시 후 다시 눌러 주세요." };
  const r = (data ?? {}) as { error?: string; liked?: boolean; like_count?: number };
  if (r.error === "login_required") return LIKE_LOGIN_REQUIRED;
  if (r.error) return { error: "교수님을 찾을 수 없어요." };
  revalidatePath("/professors");
  return { liked: !!r.liked, count: Number(r.like_count ?? 0) };
}

// ---------- 내 트리 꾸미기 (spec.md 4.7) ----------
export async function saveTreeStyle(_: FormState, fd: FormData): Promise<FormState> {
  const color = String(fd.get("tree_color") ?? "");
  const theme = String(fd.get("theme") ?? "") as ThemeId;
  if (!isTreeColor(color) || !USER_THEME_IDS.includes(theme)) return { error: "트리 색과 배경을 골라 주세요." };
  if (demoMode) {
    const s = await readDemoSession();
    if (!s) redirect("/login?next=/me/style");
    if (!s.tree) return { error: "먼저 트리를 만들어 주세요." };
    await writeDemoSession({ ...s, tree: { ...s.tree, color, theme } });
    redirect("/me?toast=styled");
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me/style");
  const { data, error } = await supabase
    .from("trees").update({ tree_color: color, theme }).eq("owner_id", user.id).eq("kind", "user").select("slug").maybeSingle();
  if (error) return { error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  if (!data) return { error: "먼저 트리를 만들어 주세요." };
  revalidatePath(`/t/${data.slug}`);
  redirect("/me?toast=styled");
}

// ---------- 관리자: 허락 받은 교수님 트리 열기·닫기 (spec.md 4.6) ----------
const LIST_FILTERS = ["all", "wait", "open"];

export async function adminSetTreeOpen(fd: FormData) {
  const open = fd.get("open") === "1";
  // 보던 필터(허락 대기·트리 열림)로 돌아간다 (spec.md 2.3)
  const filterRaw = String(fd.get("filter") ?? "");
  const filter = LIST_FILTERS.includes(filterRaw) ? filterRaw : "";
  const back = (toast: string) => `/admin?tab=list${filter ? `&filter=${filter}` : ""}&toast=${toast}`;
  if (demoMode) redirect(back("demo"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(loginPath("/admin?tab=list"));
  const { error } = await supabase.rpc("admin_set_tree_open", {
    p_tree_id: String(fd.get("tree_id")), p_open: open,
  });
  revalidatePath("/admin");
  revalidatePath("/professors");
  redirect(back(error ? "failed" : open ? "opened" : "closed"));
}

// ---------- 관리자: 교수님 트리 정보 수정 (spec.md 3장, 0007) ----------
// admin_update_special_tree(0007)가 돌려주는 오류 코드 → 사용자 문구 (spec.md 2.3: DB 문장을 그대로 보이지 않는다)
const UPDATE_ERRORS: Record<string, string> = {
  not_allowed: "관리자만 고칠 수 있어요.",
  not_found: "트리를 찾을 수 없어요.",
  not_a_special_tree: "교수님·특별 트리만 고칠 수 있어요.",
  invalid_title: "트리 이름을 입력해주세요.",
  invalid_owner_name: "주인 이름을 입력해주세요.",
  invalid_theme: "테마를 다시 골라 주세요.",
  invalid_department: "학과를 다시 골라 주세요.",
  invalid_description: "설명은 200자까지 쓸 수 있어요.",
};
const UPDATE_FAILED = "고치지 못했어요. 잠시 후 다시 시도해 주세요.";

export async function adminUpdateSpecialTree(_: FormState, fd: FormData): Promise<FormState> {
  if (demoMode) return { error: "데모라 저장되지 않아요. 실서버에서 고칠 수 있어요." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };
  const v = readSpecialTreeForm(fd);
  if (!v.title || !v.owner_name) return { error: "제목과 이름을 입력해주세요." };
  // 주소(slug)는 바꾸지 않는다 — 교수님 열람 링크가 /t/<slug>?key=… 라서 깨진다 (0007)
  const { data, error } = await supabase.rpc("admin_update_special_tree", {
    p_tree_id: String(fd.get("tree_id")),
    p_title: v.title, p_owner_name: v.owner_name,
    p_theme: v.theme, p_department: v.department, p_description: v.description,
  });
  if (error) return { error: UPDATE_FAILED };
  const r = (data ?? {}) as { ok?: boolean; error?: string };
  if (r.ok !== true) return { error: UPDATE_ERRORS[r.error ?? ""] ?? UPDATE_FAILED };
  // 보던 필터로 돌아간다 (adminSetTreeOpen 과 같음, spec.md 2.3)
  const filterRaw = String(fd.get("filter") ?? "");
  const filter = LIST_FILTERS.includes(filterRaw) ? filterRaw : "";
  revalidatePath("/admin");
  revalidatePath("/professors");
  revalidatePath("/");
  redirect(`/admin?tab=list${filter ? `&filter=${filter}` : ""}&toast=updated`);
}

// ---------- 관리자: 교수님 비밀 열람 링크 (spec.md 4.6, T9) ----------
// 키는 DB(admin_issue_read_key)가 만들고, 다시 만들면 이전 키는 무효. 관리자 확인도 DB가 한다.
export async function adminIssueReadLink(fd: FormData) {
  if (demoMode) redirect("/admin?tab=list&toast=demo");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_issue_read_key", { p_tree_id: String(fd.get("tree_id")) });
  revalidatePath("/admin");
  redirect(`/admin?tab=list&toast=${error ? "failed" : "link_issued"}`);
}
