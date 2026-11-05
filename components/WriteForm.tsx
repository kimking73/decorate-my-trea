"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import Snow from "@/components/Snow";
import { themeBackground } from "@/components/TreeScene";
import {
  DEPARTMENTS, ORNAMENTS, PROFESSOR_ORNAMENTS, deptOrnament, findKeywordEgg, type Ornament,
} from "@/lib/constants";

type Tree = { id: string; slug: string; title: string; owner_name: string; theme: string; kind: string; department?: string | null };

export default function WriteForm({ tree }: { tree: Tree }) {
  const router = useRouter();
  const isProfessor = tree.kind === "professor";

  const tabs = useMemo(() => {
    const t: { id: string; name: string; items: Ornament[] }[] = [];
    if (isProfessor) t.push({ id: "prof", name: "👨‍🏫 교수님", items: PROFESSOR_ORNAMENTS });
    t.push({ id: "basic", name: "기본", items: ORNAMENTS.filter((o) => o.group === "basic") });
    t.push({ id: "postech", name: "🦁 POSTECH", items: ORNAMENTS.filter((o) => o.group === "postech") });
    t.push({ id: "dept", name: "학과", items: DEPARTMENTS.map((d) => deptOrnament(d.id)!) });
    return t;
  }, [isProfessor]);

  const [step, setStep] = useState<1 | 2>(1);
  const [tab, setTab] = useState(tabs[0].id);
  const [ornament, setOrnament] = useState<string>(tabs[0].items[0].id);
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [confession, setConfession] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [egg, setEgg] = useState<string | null>(null);
  const [hearts, setHearts] = useState(false);

  const egged = findKeywordEgg(content);

  async function submit() {
    setError(null);
    if (!content.trim()) return setError("편지 내용을 써주세요!");
    setSending(true);
    const res = await fetch("/api/letters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId: tree.id, ornamentType: ornament, nickname, content, isConfession: confession }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSending(false);
      return setError(json.error ?? "문제가 생겼어요. 다시 시도해주세요.");
    }

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
  const selected = current.items.find((o) => o.id === ornament) ?? tabs.flatMap((t) => t.items).find((o) => o.id === ornament);

  return (
    <main className="relative min-h-dvh" style={themeBackground(tree.theme)}>
      <Snow density={30} />
      <div className="relative z-10 mx-auto max-w-md px-4 pb-10 pt-5">
        <Link href={`/t/${tree.slug}`} className="text-sm opacity-90">← {tree.owner_name}님의 트리</Link>
        <h1 className="font-display mt-3 text-2xl">
          {step === 1 ? "어떤 장식을 달아줄까요?" : "편지를 써주세요 ✍️"}
        </h1>
        <p className="mt-1 text-sm opacity-85">편지는 익명으로 전달되고, 크리스마스에 {tree.owner_name}님만 읽을 수 있어요.</p>

        {step === 1 && (
          <section className="card mt-4 p-4">
            <div className="mb-3 flex gap-1 overflow-x-auto">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${tab === t.id ? "bg-[#c8102e] text-white" : "bg-slate-100"}`}>
                  {t.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {current.items.map((o) => (
                <button key={o.id} onClick={() => setOrnament(o.id)}
                  className={`flex flex-col items-center gap-1 rounded-2xl p-2 ${ornament === o.id ? "ring-3 ring-[#c8102e]" : ""}`}>
                  <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-white text-2xl shadow" style={{ background: o.bg }}>{o.emoji}</span>
                  <span className="text-center text-[11px] leading-tight">{o.label}</span>
                </button>
              ))}
            </div>
            <button className="btn btn-primary mt-5 w-full" onClick={() => setStep(2)}>다음</button>
          </section>
        )}

        {step === 2 && (
          <section className={`card mt-4 p-4 ${egged?.effect === "cry" ? "shake" : ""}`}>
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-white text-2xl shadow" style={{ background: selected?.bg }}>
                {egged?.effect === "cry" ? "😭" : selected?.emoji}
              </span>
              <button className="text-sm text-slate-500 underline" onClick={() => setStep(1)}>장식 바꾸기</button>
            </div>

            <label className="text-sm font-bold">보내는 사람 <span className="font-normal text-slate-500">(비워두면 &quot;익명의 산타&quot;)</span></label>
            <input
              value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20}
              placeholder="익명의 산타"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-[#c8102e]"
            />

            <label className="mt-4 block text-sm font-bold">편지</label>
            <textarea
              value={content} onChange={(e) => setContent(e.target.value)} maxLength={1000} rows={8}
              placeholder={isProfessor ? "교수님, 한 학기 동안 감사했습니다..." : "메리 크리스마스! 올해도 고마웠어 🎄"}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 leading-7 outline-none focus:border-[#c8102e]"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>{egged ? "✨ 뭔가 일어날 것 같은 예감..." : ""}</span>
              <span>{content.length}/1000</span>
            </div>

            {!isProfessor && (
              <label className={`mt-4 flex cursor-pointer items-center justify-between rounded-2xl p-3 ${confession ? "bg-pink-100" : "bg-slate-50"}`}>
                <span>
                  <span className="font-bold">💘 이 편지는 고백이에요</span>
                  <span className="block text-xs text-slate-500">트리에는 일반 장식으로 보여서 아무도 몰라요. 크리스마스에 편지를 열 때만 주인에게 &lsquo;고백 편지&rsquo;로 표시되고, 홈 화면 고백 카운터에 집계돼요.</span>
                </span>
                <input type="checkbox" className="h-5 w-5 accent-pink-500" checked={confession} onChange={(e) => setConfession(e.target.checked)} />
              </label>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button className="btn btn-primary mt-5 w-full" onClick={submit} disabled={sending}>
              {sending ? "트리에 다는 중..." : "🎄 트리에 달기"}
            </button>
          </section>
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
