import { notFound } from "next/navigation";
import type { Metadata } from "next";
import OwnerMenu from "@/components/OwnerMenu";
import TreeView from "@/components/TreeView";
import { demoMode, getLetters, getLettersByReadKey, getOrnaments, getProfile, getRevealAt, getTreeBySlug, getUser } from "@/lib/data";
import { getSeason, parseForcedDday } from "@/lib/season";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ added?: string; egg?: string; dday?: string; owner?: string; toast?: string; key?: string }> };

/** 교수님 비밀 열람 링크의 키 (spec.md 4.6). 맞는지는 DB가 판단하고, 여기서는 모양만 거른다 */
function readKeyParam(key: unknown) {
  return typeof key === "string" ? key.trim().slice(0, 64) : "";
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { key } = await searchParams;
  const tree = await getTreeBySlug(slug);
  if (!tree) return { title: "트리를 찾을 수 없어요" };
  const title = `${tree.owner_name}님의 크리스마스 트리 🎄`;
  const description = `${tree.title} — 익명으로 편지를 달아주세요! 편지는 12월 25일에 열려요.`;
  // OG 주소에는 키를 넣지 않는다. 키가 붙은 주소는 검색에 잡히지 않게 (spec.md 4.6)
  return {
    title, description, openGraph: { title, description, url: `${SITE_URL}/t/${slug}` },
    // 다른 사이트로 이동·리소스 요청 시 키가 든 주소가 Referer 로 새지 않게 (오래된 인앱 WebView 기본값 대비)
    ...(readKeyParam(key) ? { robots: { index: false, follow: false }, referrer: "no-referrer" as const } : {}),
  };
}

export default async function TreePage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { added, egg, dday, owner, toast, key } = await searchParams;
  const tree = await getTreeBySlug(slug);
  if (!tree) notFound();

  // 교수님 비밀 열람 링크 (spec.md 4.6, T9): null = 키가 틀림 → 그냥 방문자 화면. 본문 공개 시점은 DB가 강제한다.
  const readKey = tree.kind === "professor" ? readKeyParam(key) : "";
  const [user, ornaments, revealAt, keyLetters] = await Promise.all([
    getUser(), getOrnaments(tree.id), getRevealAt(), readKey ? getLettersByReadKey(tree.slug, readKey) : null,
  ]);
  // ?owner=1 은 데모 모드 전용 주인 화면 미리보기 (인앱 브라우저 QA 용: 공유 버튼·스토리 이미지 저장 확인).
  // 기준은 NODE_ENV 가 아니라 demoMode — Supabase 가 설정된 서버에서는 항상 false 라 완전히 무시된다.
  // 화면만 주인용으로 그릴 뿐 편지 본문 권한과는 무관하다 (본문은 DB RLS is_revealed() + 소유자 검사가 강제).
  // ?owner=0 은 데모 로그인한 주인이 방문자 화면을 볼 때 (spec.md 4.2, 데모 모드 전용)
  const ownerPreview = demoMode && owner === "1";
  const visitorPreview = demoMode && owner === "0";
  const isOwner = !visitorPreview && (ownerPreview || (!!user && user.id === tree.owner_id));
  const revealed = Date.now() >= revealAt.getTime();
  // ?dday=N 은 연출 미리보기 전용 (개발/데모 모드). 편지 열람 권한에는 영향 없음.
  const forced = parseForcedDday(dday, demoMode || process.env.NODE_ENV !== "production");
  const season = getSeason(Date.now(), revealAt, forced);
  // 서버에서도 한 번 더: 주인 + 공개 이후에만 본문 요청 (DB RLS 가 최종 방어선)
  // 데모 주인 미리보기에서는 ?dday=0 으로 공개 후를 흉내 낼 때도 (가짜) 데모 편지를 넘긴다.
  // demoMode 가 아니면 이 조건은 revealed 그대로라 실서버의 열람 판단은 바뀌지 않는다.
  // 열람 링크(reader)는 주인이 아닐 때만. 본문은 DB가 공개 이후에만 주므로 실서버에서는 받은 그대로 넘긴다.
  // 데모는 가짜 편지가 늘 오므로 ?dday 로 흉내 낸 공개 전에는 넘기지 않는다.
  const reader = !isOwner && keyLetters !== null;
  const letters = reader
    ? (demoMode && !season.revealed ? null : keyLetters)
    : isOwner && (revealed || (demoMode && season.revealed)) ? await getLetters(tree.id) : null;

  // 주인 화면 = 내 트리: 예전 "내 페이지" 메뉴를 트리 아래에 붙인다 (spec.md 5.1, F10)
  const profile = isOwner && user ? await getProfile() : null;
  const shareUrl = `${SITE_URL}/t/${tree.slug}`;

  return (
    <TreeView
      tree={tree}
      ornaments={ornaments}
      letters={letters}
      isOwner={isOwner}
      isLoggedIn={!!user}
      season={season}
      revealAt={revealAt.toISOString()}
      shareUrl={shareUrl}
      justAdded={added === "1"}
      egg={egg}
      demo={demoMode}
      reader={reader}
      ownerMenu={isOwner ? <OwnerMenu shareUrl={shareUrl} isAdmin={!!profile?.is_admin} demo={demoMode} toast={toast} /> : undefined}
    />
  );
}
