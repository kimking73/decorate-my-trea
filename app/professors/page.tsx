import Link from "next/link";
import ProfessorList from "@/components/ProfessorList";
import { getProfessors, getUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "교수님께 마음 전하기 · 포스텍 트리" };

// 교수님께 마음 전하기 (spec.md 3장 "학생 → 교수님", 4.6). 로그인 없이 볼 수 있고 하트만 로그인 필요
export default async function ProfessorsPage() {
  const [user, professors] = await Promise.all([getUser(), getProfessors()]);

  return (
    <main className="min-h-dvh" style={{ background: "linear-gradient(#20372b, #2f4d3c)" }}>
      <header className="mx-auto flex h-14 max-w-md items-center justify-between px-2">
        <Link href="/" className="flex min-h-11 items-center px-2 text-sm opacity-85">← 홈으로</Link>
        {!user && <Link href="/login?next=/professors" className="flex min-h-11 items-center px-2 text-sm">로그인</Link>}
      </header>
      <div className="mx-auto max-w-md px-4 pb-10 pt-2">
        <h1 className="font-display text-3xl">교수님께 마음 전하기</h1>
        <p className="mt-2 text-[15px] leading-6 opacity-90">
          트리가 열린 교수님께는 익명 편지를 남길 수 있어요. 아직이라면 하트로 관심을 보내 주세요.
        </p>
        {!user && <p className="mt-1 text-sm opacity-75">하트는 로그인하면 누를 수 있어요.</p>}
        <ProfessorList professors={professors} isLoggedIn={!!user} />
      </div>
    </main>
  );
}
