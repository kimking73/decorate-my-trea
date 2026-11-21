"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import TreeScene, { SLOTS_PER_PAGE, themeBackground, type SceneOrnament, type SceneSeason } from "@/components/TreeScene";
import LetterModal, { type Letter } from "@/components/LetterModal";
import ShareButtons from "@/components/ShareButtons";
import Countdown from "@/components/Countdown";
import Snow from "@/components/Snow";
import { createClient } from "@/lib/supabase/client";
import { TOTAL_BULBS } from "@/lib/season";
import { useRevealRefresh } from "@/components/useRevealRefresh";

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

// 스와이프로 인정하는 최소 가로 이동(px). 세로 스크롤과 구분하려고 가로가 세로의 1.5배 이상일 때만 넘긴다.
const SWIPE_MIN = 40;
const noSubscribe = () => () => {};

/** 데모 모드 전용: `?fill=60`이면 데모 장식을 복제해 60개로 채운다 (페이지 넘김 확인용, 실서버에서는 무시). */
function useDemoFill(demo: boolean, search: string) {
  if (!demo) return 0;
  const n = Number(new URLSearchParams(search).get("fill"));
  return Number.isInteger(n) && n > 0 ? Math.min(n, 500) : 0;
}

export default function TreeView(p: Props) {
  const router = useRouter();
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const fill = useDemoFill(p.demo, search);
  // 데모 모드 전용: 주인 화면 ↔ 방문자 화면 전환 링크 (?dday·?fill 등 나머지 쿼리는 유지).
  // 데모에는 로그인이 없으므로 demo && isOwner 는 `?owner=1` 미리보기뿐이다 (실서버에서는 서버가 무시).
  const ownerToggleHref = useMemo(() => {
    const q = new URLSearchParams(search);
    if (p.isOwner) q.delete("owner");
    else q.set("owner", "1");
    const qs = q.toString();
    return `/t/${p.tree.slug}${qs ? `?${qs}` : ""}`;
  }, [search, p.isOwner, p.tree.slug]);
  const base = useMemo(() => {
    if (!fill || p.ornaments.length === 0) return p.ornaments;
    return Array.from({ length: fill }, (_, i) => {
      const o = p.ornaments[i % p.ornaments.length];
      return i < p.ornaments.length ? o : { ...o, id: `${o.id}-fill${i}` };
    });
  }, [p.ornaments, fill]);
  const count = base.length;
  const pages = Math.max(1, Math.ceil(count / SLOTS_PER_PAGE));
  // null = 아직 넘긴 적 없음: 방금 편지를 달고 왔으면 새 장식이 있는 마지막 트리, 아니면 첫 트리.
  const [picked, setPicked] = useState<{ page: number; dir: 1 | -1 } | null>(null);
  // 신고 등으로 장식이 줄어 페이지 수가 줄어도 범위를 벗어나지 않게 한다.
  const page = Math.min(picked?.page ?? (p.justAdded ? pages - 1 : 0), pages - 1);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
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
    () => base.map((o, i) => ({ ...o, isNew: p.justAdded && i === base.length - 1 })),
    [base, p.justAdded],
  );
  const letterMap = useMemo(() => new Map((p.letters ?? []).map((l) => [l.id, l])), [p.letters]);
  const isSpecial = p.tree.kind !== "user";
  const revealed = p.season.revealed;
  // 0시에 요청을 흩는 범위: 편지를 읽을 주인은 짧게, 방문자는 길게 (spec.md 4.5)
  const revealPhase = useRevealRefresh(p.revealAt, revealed, p.isOwner ? 30_000 : 120_000);

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

  function go(to: number) {
    const next = Math.max(0, Math.min(pages - 1, to));
    if (next !== page) setPicked({ page: next, dir: next > page ? 1 : -1 });
  }

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    swipeStart.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  }
  function onTouchEnd(e: TouchEvent) {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(page + (dx < 0 ? 1 : -1));
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") go(page - 1);
    else if (e.key === "ArrowRight") go(page + 1);
    else return;
    e.preventDefault();
  }

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
          <>
            <p className="mb-2 rounded-full bg-yellow-300 px-3 py-1 text-xs text-black">데모 모드 — Supabase 연결 전 미리보기</p>
            <p className="mb-2 flex items-center gap-2 text-xs">
              {p.isOwner && <span className="rounded-full bg-pink-300 px-3 py-1 text-black">데모: 주인 화면 미리보기</span>}
              <Link href={ownerToggleHref} className="rounded-full bg-white/15 px-3 py-1 underline">
                {p.isOwner ? "방문자 화면으로 보기" : "주인 화면으로 보기"}
              </Link>
            </p>
          </>
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

          <div
            className={`mt-3 w-full ${picked ? "page-anim" : ""}`}
            style={pages > 1 ? { touchAction: "pan-y", ["--page-dir" as string]: picked?.dir ?? 1 } : undefined}
            onTouchStart={pages > 1 ? onTouchStart : undefined}
            onTouchEnd={pages > 1 ? onTouchEnd : undefined}
            onTouchCancel={() => { swipeStart.current = null; }}
            onKeyDown={pages > 1 ? onKeyDown : undefined}
          >
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
          <nav aria-label="트리 넘기기" className="mt-2 flex items-center gap-2 text-sm">
            <button type="button" className="btn btn-ghost !px-3 !py-1 text-xs" disabled={page === 0} onClick={() => go(0)}>처음</button>
            <button type="button" className="btn btn-ghost !px-3 !py-1" disabled={page === 0} onClick={() => go(page - 1)} aria-label="이전 트리">◀</button>
            <span className="min-w-14 text-center tabular-nums" aria-hidden>{page + 1} / {pages}</span>
            <span className="sr-only" role="status">트리 {pages}개 중 {page + 1}번째 트리</span>
            <button type="button" className="btn btn-ghost !px-3 !py-1" disabled={page === pages - 1} onClick={() => go(page + 1)} aria-label="다음 트리">▶</button>
            <button type="button" className="btn btn-ghost !px-3 !py-1 text-xs" disabled={page === pages - 1} onClick={() => go(pages - 1)}>최신</button>
          </nav>
        )}

        {revealPhase !== "idle" && (
          <div role="status" className="pop-in fixed inset-x-0 top-4 z-40 mx-auto w-max max-w-[90%] rounded-full bg-black/75 px-4 py-2 text-sm text-white">
            {revealPhase === "opening"
              ? "🎁 산타가 편지를 꺼내는 중이에요…"
              : "🎅 편지 상자가 붐벼요. 잠시 뒤 새로고침해 주세요"}
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
