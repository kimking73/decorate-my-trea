import Link from "next/link";
import { redirect } from "next/navigation";
import TreeStyleForm from "@/components/TreeStyleForm";
import { getMyTree, getOrnaments, getRevealAt, getUser } from "@/lib/data";
import { getSeason } from "@/lib/season";

export const dynamic = "force-dynamic";

// 내 트리 꾸미기: 트리 색·배경 테마 (spec.md 4.7). 트리 주인만
export default async function MyTreeStylePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/me/style");
  const tree = await getMyTree(user.id);
  if (!tree) redirect("/me");
  const [ornaments, revealAt] = await Promise.all([getOrnaments(tree.id), getRevealAt()]);
  const { progress, bulbsOn, daysLeft, revealed } = getSeason(Date.now(), revealAt);

  return (
    <main className="min-h-dvh" style={{ background: "linear-gradient(#0f2a44,#1c4566)" }}>
      <header className="mx-auto flex h-14 max-w-md items-center justify-between px-2">
        <Link href="/me" className="flex min-h-11 items-center px-2 text-sm opacity-85">← 내 페이지</Link>
        <span className="pr-2 text-[15px] font-bold">내 트리 꾸미기</span>
      </header>
      <div className="mx-auto max-w-md px-4 pb-6">
        <TreeStyleForm
          initialColor={tree.tree_color}
          initialTheme={tree.theme}
          ornaments={ornaments.slice(0, 18)}
          season={{ progress, bulbsOn, daysLeft, revealed }}
        />
      </div>
    </main>
  );
}
