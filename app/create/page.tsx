import Link from "next/link";
import { redirect } from "next/navigation";
import TreeForm from "@/components/TreeForm";
import { getMyTree, getProfile, getRevealAt, getUser, loginPath } from "@/lib/data";
import { getSeason } from "@/lib/season";

export const dynamic = "force-dynamic";

// 트리가 없으면 새로 만들기, 있으면 이름 바꾸기 (같은 경로, spec.md 5.1)
export default async function CreatePage() {
  const user = await getUser();
  if (!user) redirect(loginPath("/create"));
  const [tree, profile, revealAt] = await Promise.all([getMyTree(user.id), getProfile(), getRevealAt()]);
  const { progress, bulbsOn, daysLeft, revealed } = getSeason(Date.now(), revealAt);

  return (
    <main className="min-h-dvh" style={{ background: "linear-gradient(#0f2a44,#1c4566)" }}>
      <header className="mx-auto flex h-14 max-w-md items-center px-2">
        <Link href={tree ? "/me" : "/"} className="flex min-h-11 items-center px-2 text-sm opacity-85">
          {tree ? "← 내 트리" : "← 홈으로"}
        </Link>
      </header>
      <div className="mx-auto max-w-md px-4 pb-8 pt-2">
        <TreeForm
          mode={tree ? "rename" : "create"}
          initialName={tree?.owner_name ?? profile?.display_name ?? ""}
          currentTitle={tree?.title ?? null}
          season={{ progress, bulbsOn, daysLeft, revealed }}
        />
      </div>
    </main>
  );
}
