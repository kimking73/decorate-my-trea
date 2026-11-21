import Link from "next/link";
import { redirect } from "next/navigation";
import { demoSignOut } from "@/app/actions";
import { demoMode, getMyTree, getUser, loginPath } from "@/lib/data";

export const dynamic = "force-dynamic";

// "내 트리"로 들어가는 주소 (spec.md 5.1, F10). 예전 "내 페이지"는 내 트리(/t/[slug] 주인 화면)에 합쳤다.
// 트리가 있으면 내 트리로 보내고(?toast=는 그대로), 없으면 "아직 트리가 없어요".
export default async function MePage({ searchParams }: { searchParams: Promise<{ toast?: string }> }) {
  const user = await getUser();
  if (!user) redirect(loginPath("/me"));
  const tree = await getMyTree(user.id);
  if (tree) {
    const { toast } = await searchParams;
    redirect(`/t/${tree.slug}${toast ? `?toast=${encodeURIComponent(toast)}` : ""}`);
  }

  return (
    <main className="flex min-h-dvh flex-col" style={{ background: "linear-gradient(#0f2a44,#1c4566)" }}>
      <header className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
        <Link href="/" className="font-display flex min-h-11 items-center text-lg">🎄 포스텍 트리</Link>
        <span className="text-[15px] font-bold">내 트리</span>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-6 pt-4">
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/50 px-4 py-7 text-center">
          <p className="text-5xl" aria-hidden>🌲</p>
          <h1 className="font-display text-2xl">아직 트리가 없어요</h1>
          <p className="text-sm opacity-85">이름만 적으면 바로 만들 수 있어요.</p>
          <Link href="/create" className="btn btn-primary w-full text-lg">🎄 내 트리 만들기</Link>
        </section>
      </div>

      <footer className="flex justify-center border-t border-white/15 p-4">
        <form {...(demoMode ? { action: demoSignOut } : { action: "/auth/signout", method: "post" })}>
          <button className="min-h-11 px-4 text-sm underline opacity-80">로그아웃</button>
        </form>
      </footer>
    </main>
  );
}
