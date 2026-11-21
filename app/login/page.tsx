import Link from "next/link";
import { redirect } from "next/navigation";
import InAppNotice from "@/components/InAppNotice";
import LoginButtons from "@/components/LoginButtons";
import Snow from "@/components/Snow";
import { demoMode, getUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/me";
  if (await getUser()) redirect(safeNext);

  return (
    <main className="relative flex min-h-dvh flex-col" style={{ background: "linear-gradient(#0f2a44,#1c4566)" }}>
      <Snow />
      <header className="relative z-10 mx-auto flex h-14 w-full max-w-sm items-center px-2">
        <Link href="/" className="flex min-h-11 items-center px-2 text-sm opacity-85">← 홈으로</Link>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col px-4 pb-8 text-center">
        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-left text-slate-800">
            <p className="text-sm font-bold text-red-700">로그인하지 못했어요</p>
            <p className="text-sm">루돌프가 숨 고르는 중이에요. 잠시 후 다시 시도해 주세요.</p>
          </div>
        )}

        <p className="mt-6 text-6xl" aria-hidden>🎄</p>
        <h1 className="font-display mt-3 text-3xl">내 트리 만들기</h1>
        <p className="mt-2 text-sm leading-6 opacity-85">로그인은 트리 주인만 하면 돼요.<br />편지를 쓰는 친구들은 로그인 없이<br />익명으로 쓸 수 있어요!</p>
        {demoMode && <p className="mt-3 rounded-xl bg-yellow-300 p-2 text-xs text-black">데모 모드: Supabase 환경변수를 설정하면 로그인이 동작해요. <Link className="underline" href="/t/demo">데모 트리 보기</Link></p>}

        <div className="mt-8">
          <LoginButtons next={safeNext} enableEmail={process.env.NEXT_PUBLIC_ENABLE_EMAIL_LOGIN === "true"} />
        </div>

        <InAppNotice />

        <div className="min-h-8 flex-1" />
        <aside className="rounded-2xl bg-white/10 px-4 py-3.5 text-left text-sm leading-6">
          <b>편지를 쓰러 왔나요?</b>
          <br />친구에게 받은 트리 링크로 들어가면 로그인 없이 바로 쓸 수 있어요.
        </aside>
      </div>
    </main>
  );
}
