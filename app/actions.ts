"use server";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEPARTMENTS, isTreeColor, THEMES, USER_THEME_IDS, type ThemeId } from "@/lib/constants";
import {
  DEFAULT_DEMO_SESSION, DEMO_SESSION_COOKIE, demoMode, demoProfessorBaseCount, readDemoSession, type DemoSession,
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
  const theme = themeRaw in THEMES ? themeRaw : "chalkboard";
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
export async function adminCreateSpecialTree(_: FormState, fd: FormData): Promise<FormState> {
  if (demoMode) return { error: "데모라 저장되지 않아요. 실서버에서는 허락 대기 트리로 만들어져요." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };
  const v = readSpecialTreeForm(fd);
  const kind = fd.get("kind") === "special" ? "special" : "professor";
  const slugRaw = String(fd.get("slug") ?? "").trim().toLowerCase();
  const slug = /^[a-z0-9-]{4,40}$/.test(slugRaw) ? slugRaw : `prof-${randomSlug(6)}`;
  if (!v.title || !v.owner_name) return { error: "제목과 이름을 입력해주세요." };
  const { error } = await supabase.from("trees").insert({
    owner_id: user.id, slug, kind, title: v.title, owner_name: v.owner_name,
    theme: v.theme, description: v.description, department: v.department,
  });
  if (error) return { error: `생성 실패: ${error.message}` };
  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function adminIssueClaimCode(fd: FormData) {
  const supabase = await createClient();
  const treeId = String(fd.get("tree_id"));
  await supabase.rpc("admin_set_claim_code", { p_tree_id: treeId, p_code: randomSlug(10) });
  revalidatePath("/admin");
}

export async function adminResolve(fd: FormData) {
  if (demoMode) redirect("/admin?tab=reports&toast=demo");
  const supabase = await createClient();
  await supabase.rpc("admin_resolve_report", {
    p_letter_id: String(fd.get("letter_id")), p_restore: fd.get("restore") === "1",
  });
  revalidatePath("/admin");
}

// ---------- 교수님 하트 (spec.md 4.6) ----------
export async function toggleProfessorLike(treeId: string): Promise<{ liked: boolean; count: number } | { error: string }> {
  if (demoMode) {
    const s = await readDemoSession();
    const base = demoProfessorBaseCount(treeId);
    if (!s) return { error: "로그인하면 하트를 보낼 수 있어요." };
    if (base === null) return { error: "교수님을 찾을 수 없어요." };
    const liked = !s.likes.includes(treeId);
    await writeDemoSession({ ...s, likes: liked ? [...s.likes, treeId] : s.likes.filter((x) => x !== treeId) });
    return { liked, count: base + (liked ? 1 : 0) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_professor_like", { p_tree_id: treeId });
  if (error) return { error: "잠시 후 다시 눌러 주세요." };
  const r = (data ?? {}) as { error?: string; liked?: boolean; like_count?: number };
  if (r.error === "login_required") return { error: "로그인하면 하트를 보낼 수 있어요." };
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
export async function adminSetTreeOpen(fd: FormData) {
  if (demoMode) redirect("/admin?tab=list&toast=demo");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_tree_open", {
    p_tree_id: String(fd.get("tree_id")), p_open: fd.get("open") === "1",
  });
  revalidatePath("/admin");
  revalidatePath("/professors");
  redirect(`/admin?tab=list&toast=${error ? "failed" : fd.get("open") === "1" ? "opened" : "closed"}`);
}
