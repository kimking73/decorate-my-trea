import Link from "next/link";
import { redirect } from "next/navigation";
import ClaimForm from "@/components/ClaimForm";
import Countdown from "@/components/Countdown";
import { getMyTree, getOrnaments, getOwnedSpecialTrees, getProfile, getRevealAt, getUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/me");
  const [tree, special, profile, revealAt] = await Promise.all([
    getMyTree(user.id), getOwnedSpecialTrees(user.id), getProfile(), getRevealAt(),
  ]);
  if (!tree && special.length === 0) redirect("/create");
  const count = tree ? (await getOrnaments(tree.id)).length : 0;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-6" style={{ background: "linear-gradient(#0f2a44,#1c4566)" }}>
      <Link href="/" className="text-sm opacity-85">← 홈</Link>
      <h1 className="font-display mt-3 text-2xl">{profile?.display_name ?? "산타"}님, 안녕하세요 🎅</h1>
      <div className="mt-4"><Countdown target={revealAt.toISOString()} /></div>

      {tree && (
        <section className="card mt-5 p-5">
          <p className="text-sm text-slate-500">내 트리</p>
          <p className="font-display text-xl">{tree.title}</p>
          <p className="mt-1">💌 받은 편지 <b>{count}</b>개</p>
          <div className="mt-4 flex gap-2">
            <Link href={`/t/${tree.slug}`} className="btn btn-primary flex-1">트리 보기</Link>
            <Link href="/create" className="btn btn-light flex-1">설정</Link>
          </div>
        </section>
      )}

      {special.length > 0 && (
        <section className="card mt-4 p-5">
          <p className="text-sm text-slate-500">내가 관리하는 특별 트리</p>
          <ul className="mt-2 space-y-2">
            {special.map((t) => <li key={t.id}><Link className="underline" href={`/t/${t.slug}`}>👨‍🏫 {t.title}</Link></li>)}
          </ul>
        </section>
      )}

      <section className="card mt-4 p-5">
        <p className="mb-2 text-sm font-bold">교수님이신가요? 🎓</p>
        <p className="mb-3 text-xs text-slate-500">운영진에게 받은 초대 코드를 입력하면 교수님 트리의 주인이 되어 크리스마스에 편지를 읽을 수 있어요.</p>
        <ClaimForm />
      </section>

      <div className="mt-6 flex justify-between text-sm">
        {profile?.is_admin ? <Link href="/admin" className="underline">관리자</Link> : <span />}
        <form action="/auth/signout" method="post"><button className="underline opacity-80">로그아웃</button></form>
      </div>
    </main>
  );
}
