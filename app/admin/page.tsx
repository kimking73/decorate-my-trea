import Link from "next/link";
import { notFound } from "next/navigation";
import AdminCreateForm from "@/components/AdminCreateForm";
import { adminIssueClaimCode, adminResolve } from "@/app/actions";
import { getProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SpecialRow = { id: string; slug: string; title: string; owner_name: string; kind: string; claim_code: string | null; letter_count: number };

export default async function AdminPage() {
  const profile = await getProfile();
  if (!profile?.is_admin) notFound();
  const supabase = await createClient();
  const [{ data: trees }, { data: reported }] = await Promise.all([
    supabase.rpc("admin_list_special_trees"),
    supabase.from("letters").select("id, tree_id, nickname, content, created_at").eq("reported", true).order("created_at"),
  ]);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-6">
      <Link href="/me" className="text-sm opacity-85">← 내 페이지</Link>
      <h1 className="font-display mt-3 text-2xl">관리자</h1>

      <section className="card mt-4 p-5">
        <h2 className="font-display mb-3 text-lg">특별 트리 만들기</h2>
        <AdminCreateForm />
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-display mb-3 text-lg">특별 트리 목록</h2>
        <p className="mb-3 text-xs text-slate-500">초대 코드를 교수님께 전달하면 /me 에서 입력해 트리 주인이 됩니다.</p>
        <ul className="space-y-3">
          {((trees ?? []) as SpecialRow[]).map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div>
                <Link href={`/t/${t.slug}`} className="underline">{t.title}</Link>
                <p className="text-xs text-slate-500">/t/{t.slug} · 편지 {t.letter_count}개</p>
                {t.claim_code && <p className="text-sm">초대 코드: <code className="rounded bg-slate-100 px-1">{t.claim_code}</code></p>}
              </div>
              <form action={adminIssueClaimCode}>
                <input type="hidden" name="tree_id" value={t.id} />
                <button className="btn btn-light !py-1.5 text-sm">코드 {t.claim_code ? "재발급" : "발급"}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-display mb-3 text-lg">신고된 편지</h2>
        {(reported ?? []).length === 0 && <p className="text-sm text-slate-500">없음 🎉</p>}
        <ul className="space-y-3">
          {(reported ?? []).map((l) => (
            <li key={l.id} className="border-b pb-2">
              <p className="text-xs text-slate-500">{l.nickname} · {new Date(l.created_at).toLocaleString("ko-KR")}</p>
              <p className="whitespace-pre-wrap text-sm">{l.content}</p>
              <div className="mt-2 flex gap-2">
                <form action={adminResolve}><input type="hidden" name="letter_id" value={l.id} /><input type="hidden" name="restore" value="1" /><button className="btn btn-light !py-1 text-sm">복구</button></form>
                <form action={adminResolve}><input type="hidden" name="letter_id" value={l.id} /><input type="hidden" name="restore" value="0" /><button className="btn btn-primary !py-1 text-sm">삭제</button></form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
