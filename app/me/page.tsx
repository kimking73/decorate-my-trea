import Link from "next/link";
import { redirect } from "next/navigation";
import ShareLinkButtons from "@/components/ShareLinkButtons";
import Toast from "@/components/Toast";
import TreeScene from "@/components/TreeScene";
import { getMyTree, getOrnaments, getProfile, getRevealAt, getUser } from "@/lib/data";
import { SITE_URL } from "@/lib/constants";
import { getSeason } from "@/lib/season";

export const dynamic = "force-dynamic";

// F8에서 app/me/style/page.tsx를 만들면 true로 바꾼다 (그 전에는 404라 버튼을 숨긴다)
const STYLE_PAGE_READY = false;

// 서버 액션이 성공 후 /me?toast=… 로 보내면 화면 아래 알림을 띄운다 (spec.md 2.3)
const TOASTS: Record<string, string> = {
  renamed: "트리 이름을 바꿨어요",
  styled: "트리 색·테마를 바꿨어요",
};

export default async function MePage({ searchParams }: { searchParams: Promise<{ toast?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/me");
  const { toast } = await searchParams;
  const [tree, profile, revealAt] = await Promise.all([getMyTree(user.id), getProfile(), getRevealAt()]);
  const ornaments = tree ? await getOrnaments(tree.id) : [];
  const season = getSeason(Date.now(), revealAt);
  const shareUrl = tree ? `${SITE_URL}/t/${tree.slug}` : "";

  return (
    <main className="flex min-h-dvh flex-col" style={{ background: "linear-gradient(#0f2a44,#1c4566)" }}>
      <header className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
        <Link href="/" className="font-display flex min-h-11 items-center text-lg">🎄 포스텍 트리</Link>
        <span className="text-[15px] font-bold">내 페이지</span>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-6 pt-4">
        {tree ? (
          <>
            <section className="card flex flex-col gap-3.5 p-4">
              <div className="overflow-hidden rounded-xl" style={{ background: "linear-gradient(#0b2036, #1c4566)" }}>
                <div className="pointer-events-none mx-auto max-w-[220px]" aria-hidden>
                  <TreeScene theme={tree.theme} ornaments={ornaments.slice(0, 18)} season={season} lockedIcons />
                </div>
              </div>
              <div>
                <h1 className="font-display text-2xl">{tree.title}</h1>
                <p className="text-sm text-slate-600">
                  받은 편지 <b>{ornaments.length.toLocaleString()}통</b> ·{" "}
                  {season.revealed ? "편지가 열렸어요!" : `12월 25일 0시에 열려요 (D-${season.daysLeft})`}
                </p>
              </div>
              <Link href={`/t/${tree.slug}`} className="btn btn-primary w-full text-lg">🎄 내 트리 보러 가기</Link>
              <ShareLinkButtons url={shareUrl} title={tree.title} variant="pair" />
              <p className="select-all break-all rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-600">{shareUrl}</p>
              <div className={`grid gap-2 ${STYLE_PAGE_READY ? "grid-cols-2" : "grid-cols-1"}`}>
                {STYLE_PAGE_READY && (
                  <Link href="/me/style" className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 text-sm font-bold">색·테마 바꾸기</Link>
                )}
                <Link href="/create" className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 text-sm font-bold">이름 바꾸기</Link>
              </div>
            </section>

            <p className="rounded-2xl bg-white/10 px-4 py-3.5 text-sm leading-6">
              스토리용 이미지는 <b>내 트리 화면</b>에서 저장할 수 있어요.
            </p>
          </>
        ) : (
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/50 px-4 py-7 text-center">
            <p className="text-5xl" aria-hidden>🌲</p>
            <h1 className="font-display text-2xl">아직 트리가 없어요</h1>
            <p className="text-sm opacity-85">이름만 적으면 바로 만들 수 있어요.</p>
            <Link href="/create" className="btn btn-primary w-full text-lg">🎄 내 트리 만들기</Link>
          </section>
        )}

        {profile?.is_admin && (
          <Link href="/admin" className="flex min-h-13 items-center justify-between rounded-xl border border-dashed border-white/50 px-4 text-[15px]">
            <span>관리자 페이지</span><span aria-hidden>→</span>
          </Link>
        )}
      </div>

      <footer className="flex justify-center border-t border-white/15 p-4">
        <form action="/auth/signout" method="post">
          <button className="min-h-11 px-4 text-sm underline opacity-80">로그아웃</button>
        </form>
      </footer>

      <Toast message={(toast && TOASTS[toast]) || null} clearQuery />
    </main>
  );
}
