import Link from "next/link";
import Countdown from "@/components/Countdown";
import Snow from "@/components/Snow";
import TreeScene from "@/components/TreeScene";
import { demoMode, getMyTree, getRevealAt, getSpecialTrees, getStats, getTopTrees, getUser } from "@/lib/data";

export const dynamic = "force-dynamic";

const PREVIEW = ["ball-red", "jigok", "confession", "star", "coffee", "aplus", "gift", "stairs77", "snowman", "gwamegi"].map(
  (t, i) => ({ id: `p${i}`, ornament_type: t, nickname: t === "confession" ? "???" : ["룸메", "동기", "익명의 산타", "과대", "조원"][i % 5], is_confession: t === "confession" }),
);

export default async function Home() {
  const [user, stats, special, top, revealAt] = await Promise.all([
    getUser(), getStats(), getSpecialTrees(), getTopTrees(), getRevealAt(),
  ]);
  const myTree = user ? await getMyTree(user.id) : null;
  const cta = myTree ? { href: `/t/${myTree.slug}`, label: "🎄 내 트리 보러가기" } : user ? { href: "/create", label: "🎄 내 트리 만들기" } : { href: "/login?next=/create", label: "🎄 내 트리 만들기" };

  return (
    <main className="relative min-h-dvh overflow-x-hidden" style={{ background: "linear-gradient(#0b2036, #1c4566 55%, #2b5d7d)" }}>
      <Snow />
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 pb-12 pt-8 text-center">
        <p className="text-sm tracking-widest opacity-80">POSTECH CHRISTMAS 2026</p>
        <h1 className="font-display mt-1 text-[40px] leading-tight">포스텍 트리 🎄</h1>
        <p className="mt-2 text-[15px] opacity-90">
          내 트리를 만들어 인스타에 공유하면<br />친구들이 <b>익명 편지</b>로 트리를 꾸며줘요.<br />편지는 <b>크리스마스 당일</b>에 열려요!
        </p>

        <div className="mt-5"><Countdown target={revealAt.toISOString()} /></div>

        <div className="mt-4 w-full max-w-[300px]">
          <TreeScene theme="classic" ornaments={PREVIEW} lockedIcons />
        </div>

        <Link href={cta.href} className="btn btn-primary mt-4 w-full text-lg">{cta.label}</Link>
        {demoMode && <Link href="/t/demo" className="btn btn-light mt-3 w-full">👀 데모 트리 구경하기</Link>}

        {/* 고백 카운터 */}
        <section className="mt-8 w-full rounded-3xl bg-pink-500/25 p-5 backdrop-blur">
          <p className="text-4xl">💘</p>
          <p className="font-display mt-1 text-xl">
            지금까지 총 <span className="text-3xl text-pink-200">{stats.confession_count.toLocaleString()}</span>명이 고백하였습니다
          </p>
          <p className="mt-1 text-xs opacity-80">편지를 쓸 때 &lsquo;고백 편지&rsquo;를 켜면 하트 장식으로 달려요. 누가 고백했는지는 비밀!</p>
        </section>

        {/* 통계 */}
        <section className="mt-4 grid w-full grid-cols-3 gap-2">
          {[["🎄", "트리", stats.tree_count], ["💌", "편지", stats.letter_count], ["🔥", "오늘 달린 편지", stats.today_count]].map(([e, l, n]) => (
            <div key={String(l)} className="rounded-2xl bg-white/12 p-3 backdrop-blur">
              <p className="text-xl">{e}</p>
              <p className="font-display text-xl tabular-nums">{Number(n).toLocaleString()}</p>
              <p className="text-[11px] opacity-80">{l}</p>
            </div>
          ))}
        </section>

        {/* 특별 트리 */}
        {special.length > 0 && (
          <section className="mt-8 w-full text-left">
            <h2 className="font-display mb-2 text-xl">👨‍🏫 교수님께 마음 전하기</h2>
            <div className="flex flex-col gap-2">
              {special.map((t) => (
                <Link key={t.id} href={`/t/${t.slug}`} className="flex items-center gap-3 rounded-2xl bg-[#2f4d3c] p-4 shadow">
                  <span className="text-3xl">{t.kind === "professor" ? "🖍️" : "✨"}</span>
                  <span>
                    <span className="font-display block text-lg">{t.title}</span>
                    {t.description && <span className="block text-xs opacity-80">{t.description}</span>}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 랭킹 */}
        {top.length > 0 && (
          <section className="mt-8 w-full text-left">
            <h2 className="font-display mb-2 text-xl">🏆 장식이 가장 많은 트리</h2>
            <ol className="flex flex-col gap-2">
              {top.map((t, i) => (
                <li key={t.slug}>
                  <Link href={`/t/${t.slug}`} className="flex items-center justify-between rounded-2xl bg-white/12 px-4 py-3">
                    <span><span className="font-display mr-2">{["🥇", "🥈", "🥉", "4", "5"][i]}</span>{t.title} <span className="text-xs opacity-75">· {t.owner_name}</span></span>
                    <span className="font-display">{t.letter_count}개</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-8 w-full rounded-3xl bg-white/10 p-5 text-left text-sm leading-6">
          <h2 className="font-display mb-2 text-lg">🎁 이렇게 즐겨요</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>카카오/구글로 로그인하고 트리를 만들어요.</li>
            <li>링크를 인스타 스토리에 올려 친구들을 불러요.</li>
            <li>친구들은 로그인 없이 익명으로 편지를 달아요.</li>
            <li>12월 25일 0시, 편지가 열려요! 🎅</li>
          </ol>
          <p className="mt-3 text-xs opacity-70">psst... 트리 꼭대기 별을 마구 눌러보세요. 편지에 특별한 단어를 쓰면 무슨 일이 생길지도?</p>
        </section>

        <footer className="mt-8 text-xs opacity-60">Made with ❤️ by POSTECH students · {user ? <Link href="/me" className="underline">내 페이지</Link> : <Link href="/login" className="underline">로그인</Link>}</footer>
      </div>
    </main>
  );
}
