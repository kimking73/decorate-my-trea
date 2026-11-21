"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import Snow from "@/components/Snow";
import TreeScene, { SLOTS_PER_PAGE, themeBackground, type SceneOrnament, type SceneSeason } from "@/components/TreeScene";
import {
  DEPARTMENTS, ORNAMENTS, PROFESSOR_ORNAMENTS, deptOrnament, findKeywordEgg, type Ornament,
} from "@/lib/constants";

type Tree = {
  id: string; slug: string; title: string; owner_name: string; theme: string; kind: string;
  department?: string | null; tree_color?: string | null;
};
type Props = { tree: Tree; ornaments: SceneOrnament[]; season: SceneSeason };
type FormError = { title: string; body: string };
type Draft = { tab?: string; ornament?: string; nickname?: string; content?: string; confession?: boolean };

const DEFAULT_NICK = "익명의 산타";
// 미리보기는 TreeScene(300×370)을 그대로 그리고 줄인다 — 글자·별 크기가 함께 줄어 트리 화면과 같은 비율로 보인다
const PREVIEW_SCALE = 0.5;
// 2단계일 때 history.state 에 붙이는 표시 (폰의 뒤로 가기 = "장식 다시 고르기", spec.md 3장)
const STEP_KEY = "writeStep";

// 응답 코드별 오류 제목 (spec.md 3장 5). 본문은 서버 문구를 그대로 쓴다 — 응답 형식(5.2)은 그대로
function errorTitle(status: number) {
  if (status === 400) return "쓸 수 없는 말이 들어 있어요"; // 길이·장식은 보내기 전에 검사하므로 400은 대부분 금칙어
  if (status === 404) return "트리를 찾을 수 없어요";
  if (status === 429) return "잠시만 쉬었다 써 주세요";
  return "편지를 달지 못했어요";
}

export default function WriteForm({ tree, ornaments, season }: Props) {
  const router = useRouter();
  const isProfessor = tree.kind === "professor";

  const tabs = useMemo(() => {
    const t: { id: string; name: string; items: Ornament[] }[] = [];
    if (isProfessor) t.push({ id: "prof", name: "👨‍🏫 교수님 전용", items: PROFESSOR_ORNAMENTS });
    t.push({ id: "basic", name: "기본", items: ORNAMENTS.filter((o) => o.group === "basic") });
    t.push({ id: "postech", name: "🦁 POSTECH", items: ORNAMENTS.filter((o) => o.group === "postech") });
    t.push({ id: "dept", name: "학과", items: DEPARTMENTS.map((d) => deptOrnament(d.id)!) });
    return t;
  }, [isProfessor]);
  const allItems = useMemo(() => tabs.flatMap((t) => t.items), [tabs]);

  const [step, setStep] = useState<1 | 2>(1);
  const [tab, setTab] = useState(tabs[0].id);
  const [ornament, setOrnament] = useState<string>(tabs[0].items[0].id);
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [confession, setConfession] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [egg, setEgg] = useState<string | null>(null);
  const [hearts, setHearts] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const sent = useRef(false);
  const firstStep = useRef(true);

  const egged = findKeywordEgg(content);
  const draftKey = `write-draft:${tree.id}`;

  // 임시 저장 되살리기: 같은 탭에서 다시 들어오면 (인앱 브라우저 새로 고침 포함). 서버로는 보내지 않는다
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(draftKey);
      const d = raw ? (JSON.parse(raw) as Draft) : null;
      if (d && typeof d === "object") {
        if (typeof d.ornament === "string" && allItems.some((o) => o.id === d.ornament)) setOrnament(d.ornament);
        if (typeof d.tab === "string" && tabs.some((t) => t.id === d.tab)) setTab(d.tab);
        if (typeof d.nickname === "string") setNickname(d.nickname.slice(0, 20));
        if (typeof d.content === "string") setContent(d.content.slice(0, 1000));
        if (d.confession === true && !isProfessor) setConfession(true);
      }
    } catch { /* 저장소를 못 쓰면 임시 저장 없이 동작 */ }
    setDraftReady(true);
  }, [draftKey, allItems, tabs, isProfessor]);

  // 임시 저장 (되살린 뒤부터, 보낸 뒤에는 하지 않음)
  useEffect(() => {
    if (!draftReady || sent.current) return;
    try {
      const empty = !nickname && !content && !confession && ornament === tabs[0].items[0].id;
      if (empty) window.sessionStorage.removeItem(draftKey);
      else window.sessionStorage.setItem(draftKey, JSON.stringify({ tab, ornament, nickname, content, confession } satisfies Draft));
    } catch { /* 무시 */ }
  }, [draftReady, draftKey, tab, ornament, nickname, content, confession, tabs]);

  // 폰의 뒤로 가기: 2단계 기록에서 벗어나면 1단계로
  useEffect(() => {
    const onPop = () => setStep(window.history.state?.[STEP_KEY] === 2 ? 2 : 1);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 단계가 바뀌면 맨 위로 + 제목에 초점 (스크린 리더가 새 단계를 읽도록)
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return; }
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  // 오류는 2단계 위쪽에 뜨므로 그 자리로 스크롤
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  function goWrite() {
    setError(null);
    window.history.pushState({ ...window.history.state, [STEP_KEY]: 2 }, "");
    setStep(2);
  }

  function goPick() {
    if (window.history.state?.[STEP_KEY] === 2) window.history.back(); // popstate 가 1단계로 바꾼다
    else setStep(1);
  }

  async function submit() {
    setError(null);
    if (!content.trim()) return setError({ title: "편지를 써 주세요", body: "한 글자 이상 써야 트리에 달 수 있어요." });
    setSending(true);
    let res: Response;
    try {
      res = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId: tree.id, ornamentType: ornament, nickname, content, isConfession: confession }),
      });
    } catch {
      setSending(false);
      return setError({ title: "인터넷 연결을 확인해 주세요", body: "연결이 돌아오면 다시 눌러 주세요. 쓴 편지는 그대로 있어요." });
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSending(false);
      const title = errorTitle(res.status);
      const same = typeof json.error === "string" && json.error.replace(/[.!\s]+$/, "") === title; // 제목과 같은 문구면 본문은 안내로
      const body = json.error && !same ? json.error : res.status === 404 ? "링크가 맞는지 확인해 주세요." : "문제가 생겼어요. 다시 시도해주세요.";
      return setError({ title, body });
    }

    sent.current = true;
    try { window.sessionStorage.removeItem(draftKey); } catch { /* 무시 */ }

    // 숨은 키워드 이스터에그
    const e = findKeywordEgg(content);
    let delay = 600;
    if (e) {
      setEgg(e.message);
      delay = 2200;
      if (e.effect === "confetti") confetti({ particleCount: 180, spread: 100, origin: { y: 0.7 } });
      if (e.effect === "heart") setHearts(true);
    } else if (confession) {
      setHearts(true);
      setEgg("💘 두근두근... 크리스마스에 전해질 거예요");
      delay = 2000;
    } else {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 }, colors: ["#c8102e", "#1f7a45", "#ffd36b"] });
    }
    const q = e && (e.effect === "aplus" || e.effect === "cry") ? `&egg=${e.effect}` : "";
    setTimeout(() => router.push(`/t/${tree.slug}?added=1${q}`), delay);
  }

  const current = tabs.find((t) => t.id === tab)!;
  const selected = allItems.find((o) => o.id === ornament) ?? current.items[0];

  // 미리보기: 트리 화면의 마지막 페이지 + 고른 장식을 다음 자리에 (꽉 찼으면 새 페이지에 하나만)
  const previewOrnaments = useMemo(() => {
    const start = Math.floor(ornaments.length / SLOTS_PER_PAGE) * SLOTS_PER_PAGE;
    return [
      ...ornaments.slice(start),
      { id: `preview-${selected.id}`, ornament_type: selected.id, nickname: nickname.trim() || DEFAULT_NICK, isNew: true },
    ];
  }, [ornaments, selected.id, nickname]);

  return (
    <main className="relative flex min-h-dvh flex-col" style={themeBackground(tree.theme)}>
      <Snow density={30} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        <header className="flex h-14 items-center justify-between border-b border-current/20">
          {step === 1 ? (
            <Link href={`/t/${tree.slug}`} className="-ml-2 flex min-h-11 items-center px-2 text-sm">← 트리로</Link>
          ) : (
            <button type="button" onClick={goPick} className="-ml-2 flex min-h-11 items-center px-2 text-sm">← 장식 다시 고르기</button>
          )}
          <span className="text-[13px] opacity-80">{step === 1 ? "1 / 2 장식 고르기" : "2 / 2 편지 쓰기"}</span>
        </header>

        {step === 1 && (
          <>
            <h1 ref={headingRef} tabIndex={-1} className="font-display mt-4 text-2xl outline-none">{tree.owner_name}님의 트리 꾸며주기</h1>
            <p className="mt-1 text-sm opacity-85">로그인 없이, 익명으로 달 수 있어요.</p>

            <div
              className="mt-3 flex flex-col items-center gap-2 rounded-2xl bg-black/15 py-3"
              role="img" aria-label={`트리 미리보기: ${selected.label} 장식이 달릴 자리`}
            >
              <div className="overflow-hidden" style={{ width: 300 * PREVIEW_SCALE, height: 370 * PREVIEW_SCALE }}>
                <div inert className="pointer-events-none w-[300px] origin-top-left" style={{ transform: `scale(${PREVIEW_SCALE})` }}>
                  <TreeScene
                    theme={tree.theme}
                    treeColor={tree.tree_color}
                    ornaments={previewOrnaments}
                    season={season}
                    lockedIcons={!season.revealed}
                  />
                </div>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-800 shadow">{selected.emoji} {selected.label} 달 자리</span>
            </div>

            <section className="card mt-3 p-4">
              <div role="tablist" aria-label="장식 종류" className="mb-3 flex gap-1.5 overflow-x-auto">
                {tabs.map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-controls="ornament-panel" onClick={() => setTab(t.id)}
                    className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm ${tab === t.id ? "bg-[#c8102e] font-bold text-white" : "bg-slate-100"}`}>
                    {t.name}
                  </button>
                ))}
              </div>
              <div id="ornament-panel" role="tabpanel" aria-label={current.name} className="grid grid-cols-4 gap-2">
                {current.items.map((o) => (
                  <button key={o.id} type="button" aria-pressed={ornament === o.id} onClick={() => setOrnament(o.id)}
                    className={`flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-2xl p-2 ${ornament === o.id ? "ring-3 ring-[#c8102e]" : ""}`}>
                    <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-white text-2xl shadow" style={{ background: o.bg }}>{o.emoji}</span>
                    <span className="text-center text-[11px] leading-tight">{o.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <div className="mt-auto pt-4">
              <button type="button" className="btn btn-primary min-h-[52px] w-full" onClick={goWrite}>이 장식으로 편지 쓰기</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 ref={headingRef} tabIndex={-1} className="sr-only">편지 쓰기</h1>
            {error && (
              <div ref={errorRef} role="alert" className="mt-4 flex flex-col gap-0.5 rounded-xl border-[1.5px] border-[#b42318] bg-[#fff5f4] px-3.5 py-3">
                <span className="text-sm font-bold text-[#b42318]">{error.title}</span>
                <span className="text-[13px] leading-normal text-slate-700">{error.body}</span>
              </div>
            )}

            <section className={`card mt-4 flex flex-col gap-4 p-4 ${egged?.effect === "cry" ? "shake" : ""}`}>
              <div className="flex items-center gap-3 rounded-xl border-[1.5px] border-slate-200 px-3 py-2.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-white text-2xl shadow" style={{ background: selected.bg }}>
                  {egged?.effect === "cry" ? "😭" : selected.emoji}
                </span>
                <span className="flex flex-col">
                  <span className="text-xs text-slate-500">고른 장식</span>
                  <span className="font-bold">{selected.label}</span>
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="write-nick" className="text-sm font-bold">닉네임 <span className="font-normal text-slate-500">(선택)</span></label>
                <input
                  id="write-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20}
                  placeholder={DEFAULT_NICK} enterKeyHint="next" aria-describedby="write-nick-help"
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#c8102e]"
                />
                <span id="write-nick-help" className="text-xs text-slate-500">비워 두면 &lsquo;{DEFAULT_NICK}&rsquo;로 달려요. 장식 아래에 보이는 이름이에요.</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="write-letter" className="text-sm font-bold">편지</label>
                <textarea
                  id="write-letter" value={content} onChange={(e) => setContent(e.target.value)} maxLength={1000} rows={7}
                  placeholder={isProfessor ? "교수님, 한 학기 동안 감사했습니다..." : "크리스마스에 전하고 싶은 말을 적어 주세요"}
                  className="min-h-[150px] w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base leading-7 outline-none focus:border-[#c8102e]"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{egged ? "✨ 뭔가 일어날 것 같은 예감..." : ""}</span>
                  <span>{content.length} / 1000</span>
                </div>
              </div>

              {!isProfessor && (
                <label className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl p-3 ${confession ? "bg-pink-100" : "bg-slate-50"}`}>
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-pink-500" checked={confession} onChange={(e) => setConfession(e.target.checked)} />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-bold">💘 이 편지는 고백이에요</span>
                    <span className="text-xs leading-normal text-slate-500">트리 주인도 크리스마스 전에는 몰라요. 홈의 고백 수에만 세어져요.</span>
                  </span>
                </label>
              )}
            </section>

            {/* 아래 고정이 아니라 내용 끝 — 인앱 브라우저 키보드가 버튼·입력창을 가리지 않게 (spec.md 3장) */}
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <p className="text-center text-xs leading-normal opacity-85">편지는 12월 25일 0시에 트리 주인만 읽을 수 있어요.</p>
              <button type="button" className="btn btn-primary min-h-[52px] w-full" onClick={submit} disabled={sending}>
                {sending ? "트리에 다는 중..." : "🎄 트리에 달기"}
              </button>
            </div>
          </>
        )}
      </div>

      {egg && (
        <div className="pop-in fixed inset-x-0 top-1/3 z-50 mx-auto w-max max-w-[90%] rounded-2xl bg-black/80 px-5 py-3 text-center text-white">{egg}</div>
      )}
      {hearts && (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="float-heart absolute bottom-0 text-3xl"
              style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.15}s` }}>💗</span>
          ))}
        </div>
      )}
    </main>
  );
}
