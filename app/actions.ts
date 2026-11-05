"use server";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { THEMES, type ThemeId } from "@/lib/constants";

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
  return { title, owner_name, theme, description };
}

export type FormState = { error?: string } | undefined;

export async function saveMyTree(_: FormState, fd: FormData): Promise<FormState> {
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
    redirect(`/t/${existing.slug}`);
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
    theme: v.theme, description: v.description,
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
  const supabase = await createClient();
  await supabase.rpc("admin_resolve_report", {
    p_letter_id: String(fd.get("letter_id")), p_restore: fd.get("restore") === "1",
  });
  revalidatePath("/admin");
}
