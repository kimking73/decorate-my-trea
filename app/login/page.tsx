import Link from "next/link";
import { redirect } from "next/navigation";
import LoginButtons from "@/components/LoginButtons";
import Snow from "@/components/Snow";
import { demoMode, getUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/me";
  if (await getUser()) redirect(safeNext);

  return (
    <main className="relative grid min-h-dvh place-items-center px-4" style={{ background: "linear-gradient(#0f2a44,#1c4566)" }}>
      <Snow />
      <div className="relative z-10 w-full max-w-sm text-center">
        <p className="text-6xl">🎄</p>
        <h1 className="font-display mt-3 text-3xl">내 트리 만들기</h1>
        <p className="mt-2 text-sm opacity-85">로그인은 트리 주인만 하면 돼요.<br />편지를 쓰는 친구들은 로그인 없이 익명으로 쓸 수 있어요!</p>
        {error && <p className="mt-3 text-sm text-red-300">로그인에 실패했어요. 다시 시도해주세요.</p>}
        {demoMode && <p className="mt-3 rounded-xl bg-yellow-300 p-2 text-xs text-black">데모 모드: Supabase 환경변수를 설정하면 로그인이 동작해요. <Link className="underline" href="/t/demo">데모 트리 보기</Link></p>}
        <div className="mt-8">
          <LoginButtons next={safeNext} enableEmail={process.env.NEXT_PUBLIC_ENABLE_EMAIL_LOGIN === "true"} />
        </div>
        <Link href="/" className="mt-6 inline-block text-sm opacity-80">← 홈으로</Link>
      </div>
    </main>
  );
}
