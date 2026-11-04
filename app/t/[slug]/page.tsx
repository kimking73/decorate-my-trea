import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TreeView from "@/components/TreeView";
import { demoMode, getLetters, getOrnaments, getRevealAt, getStats, getTreeBySlug, getUser } from "@/lib/data";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ added?: string; egg?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tree = await getTreeBySlug(slug);
  if (!tree) return { title: "트리를 찾을 수 없어요" };
  const title = `${tree.owner_name}님의 크리스마스 트리 🎄`;
  const description = `${tree.title} — 익명으로 편지를 달아주세요! 편지는 12월 25일에 열려요.`;
  return { title, description, openGraph: { title, description, url: `${SITE_URL}/t/${slug}` } };
}

export default async function TreePage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { added, egg } = await searchParams;
  const tree = await getTreeBySlug(slug);
  if (!tree) notFound();

  const [user, ornaments, revealAt, stats] = await Promise.all([
    getUser(), getOrnaments(tree.id), getRevealAt(), getStats(),
  ]);
  const isOwner = !!user && user.id === tree.owner_id;
  const revealed = Date.now() >= revealAt.getTime();
  // 서버에서도 한 번 더: 주인 + 공개 이후에만 본문 요청 (DB RLS 가 최종 방어선)
  const letters = isOwner && revealed ? await getLetters(tree.id) : null;

  return (
    <TreeView
      tree={tree}
      ornaments={ornaments}
      letters={letters}
      isOwner={isOwner}
      isLoggedIn={!!user}
      revealed={revealed}
      revealAt={revealAt.toISOString()}
      shareUrl={`${SITE_URL}/t/${tree.slug}`}
      confessionCount={stats.confession_count}
      justAdded={added === "1"}
      egg={egg}
      demo={demoMode}
    />
  );
}
