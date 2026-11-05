"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TreeScene, { SLOTS_PER_PAGE, themeBackground, type SceneOrnament, type SceneSeason } from "@/components/TreeScene";
import LetterModal, { type Letter } from "@/components/LetterModal";
import ShareButtons from "@/components/ShareButtons";
import Countdown from "@/components/Countdown";
import Snow from "@/components/Snow";
import { createClient } from "@/lib/supabase/client";
import { TOTAL_BULBS } from "@/lib/season";

type Props = {
  tree: { id: string; slug: string; title: string; owner_name: string; theme: string; kind: string; description: string | null };
  ornaments: SceneOrnament[];
  letters: Letter[] | null;
  isOwner: boolean;
  isLoggedIn: boolean;
  season: SceneSeason & { started: boolean };
  revealAt: string;
  shareUrl: string;
  justAdded: boolean;
  egg?: string;
  demo: boolean;
};

export default function TreeView(p: Props) {
  const router = useRouter();
  const pages = Math.max(1, Math.ceil(p.ornaments.length / SLOTS_PER_PAGE));
  const [page, setPage] = useState(p.justAdded ? pages - 1 : 0);
  const [open, setOpen] = useState<Letter | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [crying, setCrying] = useState(p.egg === "cry");
  useEffect(() => {
    if (!crying) return;
    const t = setTimeout(() => setCrying(false), 2600);
    return () => clearTimeout(t);
  }, [crying]);

  const ornaments = useMemo(
    () => p.ornaments.map((o, i) => ({ ...o, isNew: p.justAdded && i === p.ornaments.length - 1 })),
    [p.ornaments, p.justAdded],
  );
  const letterMap = useMemo(() => new Map((p.letters ?? []).map((l) => [l.id, l])), [p.letters]);
  const isSpecial = p.tree.kind !== "user";
  const revealed = p.season.revealed;

  function say(m: string) {
    setNotice(m);
    setTimeout(() => setNotice(null), 2200);
  }

  function onOrnament(o: SceneOrnament) {
    if (!revealed) return say(`🔒 편지는 크리스마스에 열려요! (D-${p.season.daysLeft})`);
    if (!p.isOwner) return say("🤫 편지는 트리 주인만 읽을 수 있어요");
    const l = letterMap.get(o.id);
    if (l) setOpen(l);
  }

  async function report(id: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("report_letter", { p_letter_id: id });
    setOpen(null);
    if (error) return say("신고에 실패했어요");
    say("편지를 숨겼어요");
    router.refresh();
  }

  const count = p.ornaments.length;

  return (
    <main className="relative min-h-dvh overflow-x-hidden" style={themeBackground(p.tree.theme)}>
      <Snow density={Math.round(30 + 70 * p.season.progress)} />
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 pb-10 pt-5">
        <nav className="mb-2 flex w-full items-center justify-between text-sm">
          <Link href="/" className="opacity-90">🎄 포스텍 트리</Link>
          <span className="rounded-full bg-white/15 px-3 py-1">
            {revealed ? "🎁 편지 오픈!" : <Countdown target={p.revealAt} compact />}
          </span>
        </nav>

        {p.demo && (
          <p className="mb-2 rounded-full bg-yellow-300 px-3 py-1 text-xs text-black">데모 모드 — Supabase 연결 전 미리보기</p>
        )}

        <div ref={captureRef} className="flex w-full flex-col items-center rounded-3xl px-2 pb-2 pt-3" style={themeBackground(p.tree.theme)}>
          <h1 className="font-display text-center text-[26px] leading-tight">
            {isSpecial && <span className="mr-1">{p.tree.kind === "professor" ? "👨‍🏫" : "✨"}</span>}
            {p.tree.title}
          </h1>
          <p className="mt-1 text-sm opacity-90">
            <b className="font-display text-lg">{count}</b>개의 편지가 달렸어요
          </p>
          <p className="mt-1 text-xs opacity-80">
            {revealed ? "🎄 메리 크리스마스! 모든 전구가 켜졌어요"
              : p.season.started ? `💡 전구 ${p.season.bulbsOn}/${TOTAL_BULBS}개 켜짐 · 매일 하나씩 켜져요`
              : "💡 12월 1일부터 트리에 불이 하나씩 켜져요"}
          </p>
          {p.tree.description && <p className="mt-1 text-center text-xs opacity-80">{p.tree.description}</p>}

          <div className="mt-3 w-full">
            <TreeScene
              theme={p.tree.theme}
              ornaments={ornaments.slice(page * SLOTS_PER_PAGE, (page + 1) * SLOTS_PER_PAGE)}
              onOrnamentClick={onOrnament}
              season={p.season}
              lockedIcons={!revealed}
              starMode={p.egg === "aplus" ? "aplus" : "normal"}
              crying={crying}
            />
          </div>
        </div>

        {pages > 1 && (
          <div className="mt-2 flex items-center gap-3 text-sm">
            <button className="btn btn-ghost !px-3 !py-1" disabled={page === 0} onClick={() => setPage(page - 1)}>◀</button>
            <span>{page + 1} / {pages}</span>
            <button className="btn btn-ghost !px-3 !py-1" disabled={page === pages - 1} onClick={() => setPage(page + 1)}>▶</button>
          </div>
        )}

        {notice && (
          <div className="pop-in fixed inset-x-0 bottom-24 z-40 mx-auto w-max max-w-[90%] rounded-full bg-black/75 px-4 py-2 text-sm text-white">
            {notice}
          </div>
        )}

        <div className="mt-5 flex w-full flex-col gap-3">
          {p.isOwner ? (
            <>
              {!revealed && (
                <p className="text-center text-sm opacity-90">
                  편지는 <b>12월 25일 0시</b>에 열려요. 친구들에게 트리를 공유해보세요!
                </p>
              )}
              {revealed && count > 0 && <p className="text-center text-sm">장식을 눌러 편지를 읽어보세요 💌</p>}
              <ShareButtons url={p.shareUrl} title={p.tree.title} captureRef={captureRef} />
              <Link href="/me" className="btn btn-ghost w-full">내 페이지</Link>
            </>
          ) : (
            <>
              <Link href={`/t/${p.tree.slug}/write`} className="btn btn-primary w-full text-lg">
                🎁 {p.tree.owner_name}님 트리 꾸며주기
              </Link>
              {!isSpecial && (
                <Link href={p.isLoggedIn ? "/me" : "/login"} className="btn btn-light w-full">
                  🎄 {p.isLoggedIn ? "내 트리 보러가기" : "나도 트리 만들기"}
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {open && <LetterModal letter={open} onClose={() => setOpen(null)} onReport={p.demo ? undefined : report} />}
    </main>
  );
}
