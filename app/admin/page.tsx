import Link from "next/link";
import { redirect } from "next/navigation";
import AdminCreateForm from "@/components/AdminCreateForm";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { adminResolve } from "@/app/actions";
import { getProfile, getUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SpecialRow = { id: string; slug: string; title: string; owner_name: string; kind: string; letter_count: number };
type ReportRow = { id: string; content: string; created_at: string; trees: { title: string } | null };

const TABS = [
  { id: "make", label: "교수님 트리 만들기" },
  { id: "list", label: "교수님 목록" },
  { id: "reports", label: "신고" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin");
  const profile = await getProfile();

  if (!profile?.is_admin) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-5xl" aria-hidden>🔒</p>
          <h1 className="font-display mt-4 text-2xl">관리자만 볼 수 있어요</h1>
          <Link href="/me" className="btn btn-primary mt-6">내 페이지로</Link>
        </div>
      </main>
    );
  }

  const { tab: rawTab } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "make";

  // TODO(서버): 신고 목록은 lib/data.ts의 getReportedLetters()로 옮긴다 (spec.md 2.3). 탭 이름에 건수가 보여 늘 조회한다
  const supabase = await createClient();
  const [{ data: reported }, { data: trees }] = await Promise.all([
    supabase.from("letters").select("id, content, created_at, trees(title)").eq("reported", true).order("created_at"),
    tab === "list" ? supabase.rpc("admin_list_special_trees") : Promise.resolve({ data: null }),
  ]);
  const reports = (reported ?? []) as unknown as ReportRow[];
  const professors = ((trees ?? []) as SpecialRow[]).filter((t) => t.kind === "professor");

  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <header className="flex h-14 items-center justify-between px-2">
        <Link href="/me" className="flex min-h-11 items-center px-2 text-sm opacity-85">← 내 페이지</Link>
        <span className="pr-2 text-[15px] font-bold">관리자</span>
      </header>

      <nav aria-label="관리자 메뉴" className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-white/20 px-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`flex min-h-13 items-center justify-center border-b-[3px] text-sm ${t.id === tab ? "border-white font-bold" : "border-transparent opacity-70"}`}
          >
            {t.id === "reports" ? `${t.label} ${reports.length}` : t.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-5">
        {tab === "make" && (
          <section aria-label="교수님 트리 만들기">
            <p className="mb-3 text-sm opacity-80">홈의 &lsquo;교수님께 마음 전하기&rsquo;에 보일 트리를 만들어요.</p>
            <div className="card p-4"><AdminCreateForm /></div>
          </section>
        )}

        {tab === "list" && (
          <section aria-label="교수님 목록" className="flex flex-col gap-2.5">
            <h2 className="font-display text-xl">교수님 목록</h2>
            {/* TODO(서버 0003 이후): 관심 수·허락 상태·상태 거르기·"허락 받음 · 트리 열기"·"정보 수정" (spec.md 2.3, 4.6) */}
            {professors.length === 0 && <p className="rounded-xl border border-dashed border-white/40 p-4 text-center text-sm opacity-80">아직 교수님 트리가 없어요</p>}
            {professors.map((t) => (
              <div key={t.id} className="card flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{t.owner_name}</p>
                  <p className="truncate text-xs text-slate-500">{t.title} · 편지 {t.letter_count}통</p>
                </div>
                <Link href={`/t/${t.slug}`} className="flex min-h-11 shrink-0 items-center rounded-xl border border-slate-300 px-3 text-sm font-bold">트리 보기</Link>
              </div>
            ))}
          </section>
        )}

        {tab === "reports" && (
          <section aria-label="신고" className="flex flex-col gap-2.5">
            <h2 className="font-display text-xl">신고된 편지 <span className="text-base opacity-70">{reports.length}건</span></h2>
            {reports.length === 0 && <p className="rounded-xl border border-dashed border-white/40 p-4 text-center text-sm opacity-80">신고된 편지가 없어요</p>}
            {reports.map((l) => (
              <div key={l.id} className="card flex flex-col gap-2.5 p-4">
                <div className="flex justify-between gap-2 text-xs text-slate-500">
                  <span className="truncate">{l.trees?.title ?? "(알 수 없는 트리)"}</span>
                  <span className="shrink-0">{new Date(l.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
                </div>
                <p className="whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2.5 text-sm leading-6">{l.content}</p>
                <div className="grid grid-cols-2 gap-2">
                  <form action={adminResolve}>
                    <input type="hidden" name="letter_id" value={l.id} />
                    <input type="hidden" name="restore" value="1" />
                    <button className="btn btn-light w-full !py-2 text-sm">복구</button>
                  </form>
                  <form action={adminResolve}>
                    <input type="hidden" name="letter_id" value={l.id} />
                    <input type="hidden" name="restore" value="0" />
                    <ConfirmSubmitButton confirm="이 편지를 삭제할까요? 되돌릴 수 없어요." pendingLabel="삭제하는 중…" className="btn btn-primary w-full !py-2 text-sm">삭제…</ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
