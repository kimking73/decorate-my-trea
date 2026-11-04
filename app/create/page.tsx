import Link from "next/link";
import { redirect } from "next/navigation";
import TreeForm from "@/components/TreeForm";
import { getMyTree, getProfile, getUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/create");
  const [tree, profile] = await Promise.all([getMyTree(user.id), getProfile()]);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-6" style={{ background: "linear-gradient(#0f2a44,#1c4566)" }}>
      <Link href="/me" className="text-sm opacity-85">← 내 페이지</Link>
      <h1 className="font-display mb-4 mt-3 text-2xl">{tree ? "트리 꾸미기 설정" : "나만의 트리 만들기"}</h1>
      <TreeForm initial={tree} defaultName={profile?.display_name ?? ""} />
    </main>
  );
}
