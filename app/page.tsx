import Link from "next/link";
import Countdown from "@/components/Countdown";
import Snow from "@/components/Snow";
import ShareLinkButtons from "@/components/ShareLinkButtons";
import TreeScene from "@/components/TreeScene";
import { demoMode, getMyTree, getOrnaments, getRevealAt, getStats, getUser } from "@/lib/data";
import { SITE_URL } from "@/lib/constants";
import { TOTAL_BULBS, getSeason, parseForcedDday } from "@/lib/season";

export const dynamic = "force-dynamic";

const PREVIEW = ["ball-red", "jigok", "sock", "star", "coffee", "aplus", "gift", "stairs77", "snowman", "gwamegi"].map(
  (t, i) => ({ id: `p${i}`, ornament_type: t, nickname: ["룸메", "동기", "익명의 산타", "과대", "조원"][i % 5] }),
);

export default async function Home({ searchParams }: { searchParams: Promise<{ dday?: string }> }) {
  const { dday } = await searchParams;
  const [user, stats, revealAt] = await Promise.all([getUser(), getStats(), getRevealAt()]);
  const season = getSeason(Date.now(), revealAt, parseForcedDday(dday, demoMode || process.env.NODE_ENV !== "production"));
  const myTree = user ? await getMyTree(user.id) : null;
  // 받은 편지 수: 장식 개수로 센다 (spec.md 2.3). 많아지면 서버가 getLetterCount로 바꾼다
  const letterCount = myTree ? (await getOrnaments(myTree.id)).length : 0;

  return (
    <main className="relative min-h-dvh overflow-x-hidden" style={{ background: "linear-gradient(#0b2036, #1c4566 55%, #2b5d7d)" }}>
      <Snow density={Math.round(30 + 70 * season.progress)} />
      <header className="relative z-10 mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link href="/" className="font-display text-lg">🎄 포스텍 트리</Link>
        <Link href={user ? "/me" : "/login"} className="flex min-h-11 items-center px-2 text-sm">{user ? "내 트리" : "로그인"}</Link>
      </header>
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 pb-12 pt-4 text-center">
        <p className="text-sm tracking-widest opacity-80">POSTECH CHRISTMAS 2026</p>
        <h1 className="font-display mt-1 text-[40px] leading-tight">포스텍 트리 🎄</h1>
        <p className="mt-2 text-[15px] opacity-90">
          내 트리를 만들어 인스타에 공유하면<br />친구들이 <b>익명 편지</b>로 트리를 꾸며줘요.<br />편지는 <b>크리스마스 당일</b>에 열려요!
        </p>

        <div className="mt-5"><Countdown target={revealAt.toISOString()} /></div>

        <div className="mt-4 w-full max-w-[300px]">
          <TreeScene theme="classic" ornaments={PREVIEW} season={season} lockedIcons />
        </div>

        <p className="mt-1 text-xs opacity-80">
          {season.revealed ? "🎄 메리 크리스마스! 모든 전구가 켜졌어요"
            : season.started ? `💡 전구 ${season.bulbsOn}/${TOTAL_BULBS}개 켜짐 · 크리스마스까지 매일 하나씩 켜져요`
            : "💡 12월 1일부터 트리에 불이 하나씩 켜지고 눈이 쌓여요"}
        </p>

        {/* 위쪽 버튼: 로그인 전 / 로그인·트리 없음 / 로그인·트리 있음 (spec.md 3장) */}
        {myTree ? (
          <section className="mt-4 flex w-full flex-col gap-3">
            <div className="card flex items-center justify-between gap-3 px-4 py-3.5 text-left">
              <div className="min-w-0">
                <p className="font-display truncate text-lg">{myTree.title}</p>
                <p className="text-sm text-slate-500">받은 편지 {letterCount.toLocaleString()}통</p>
              </div>
              <span className="shrink-0 text-sm text-slate-500">{season.revealed ? "편지가 열렸어요" : `D-${season.daysLeft}`}</span>
            </div>
            <Link href={`/t/${myTree.slug}`} className="btn btn-primary w-full text-lg">🎄 내 트리 보러 가기</Link>
            <ShareLinkButtons url={`${SITE_URL}/t/${myTree.slug}`} title={myTree.title} variant="single" />
          </section>
        ) : (
          <section className="mt-4 flex w-full flex-col gap-3">
            <Link href={user ? "/create" : "/login?next=/create"} className="btn btn-primary w-full text-lg">🎄 내 트리 만들기</Link>
            {/* 실서버에서 무엇을 보여 줄지는 미정 (spec.md 6장) → 지금은 데모 모드에서만 */}
            {demoMode && <Link href="/t/demo" className="btn btn-light w-full">👀 데모 트리 구경하기</Link>}
          </section>
        )}

        {/* 고백 카운터 */}
        <section className="mt-8 w-full rounded-3xl bg-pink-500/25 p-5 backdrop-blur">
          <p className="text-4xl">💘</p>
          <p className="font-display mt-1 text-xl">
            지금까지 총 <span className="text-3xl text-pink-200">{stats.confession_count.toLocaleString()}</span>명이 고백하였습니다
          </p>
          <p className="mt-1 text-xs opacity-80">편지를 쓸 때 &lsquo;이 편지는 고백이에요&rsquo;를 체크하면 여기에만 집계돼요.<br />트리에서는 티가 안 나니, 누가 누구에게 고백했는지는 크리스마스까지 비밀!</p>
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

        {/* 교수님께 마음 전하기 → /professors (spec.md 3장) */}
        <Link href="/professors" className="mt-6 flex w-full items-center gap-3.5 rounded-2xl bg-[#2f4d3c] p-4 text-left shadow">
          <span className="text-3xl" aria-hidden>🖍️</span>
          <span className="min-w-0 flex-1">
            <span className="font-display block text-lg">교수님께 마음 전하기</span>
            <span className="block text-xs leading-5 opacity-85">교수님을 찾아 익명 편지를 남겨요. 아직 열리지 않았다면 관심을 보내 주세요.</span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0"><path d="M9 6l6 6-6 6" /></svg>
        </Link>

        <section className="mt-8 w-full rounded-3xl bg-white/10 p-5 text-left text-sm leading-6">
          <h2 className="font-display mb-2 text-lg">🎁 이렇게 즐겨요</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>카카오/구글로 로그인하고 트리를 만들어요.</li>
            <li>링크를 인스타 스토리에 올려 친구들을 불러요.</li>
            <li>친구들은 로그인 없이 익명으로 편지를 달아요.</li>
            <li>12월 25일 0시, 편지가 열려요! 🎅</li>
          </ol>
          <p className="mt-3 text-xs opacity-70">psst... 트리 꼭대기 별을 마구 눌러보세요. 트리 옆 포닉스도 한번 눌러보고, 편지에 특별한 단어를 쓰면 무슨 일이 생길지도?</p>
        </section>

        <footer className="mt-8 text-xs opacity-60">Made by POSTECH students · {user ? <Link href="/me" className="underline">내 트리</Link> : <Link href="/login" className="underline">로그인</Link>}</footer>
      </div>
    </main>
  );
}
