"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveMyTree } from "@/app/actions";
import TreeScene, { type SceneSeason } from "@/components/TreeScene";

const MAX_NAME = 20; // saveMyTree·DB check와 같은 길이

export default function TreeForm({ mode, initialName, currentTitle, season }: {
  mode: "create" | "rename";
  initialName: string;
  currentTitle: string | null;
  season: SceneSeason;
}) {
  const [state, action, pending] = useActionState(saveMyTree, undefined);
  const [name, setName] = useState(initialName.slice(0, MAX_NAME));
  const isCreate = mode === "create";
  const shownName = name.trim() || "포닉스";

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-slate-800">
          <p className="text-sm font-bold text-red-700">저장하지 못했어요</p>
          <p className="text-sm">{state.error}</p>
        </div>
      )}

      <div>
        <h1 className="font-display text-3xl">{isCreate ? "내 트리 만들기" : "트리 이름 바꾸기"}</h1>
        {isCreate && <p className="mt-1 text-[15px] opacity-85">이름만 적으면 바로 만들어져요.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="owner_name" className="text-sm font-bold">이름</label>
        <input
          id="owner_name" name="owner_name" required maxLength={MAX_NAME} value={name}
          onChange={(e) => setName(e.target.value)} placeholder="예: 포닉스" aria-describedby="owner_name-help"
          className="min-h-13 rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 outline-none focus:border-[#c8102e]"
        />
        <div id="owner_name-help" className="flex justify-between text-xs opacity-80">
          <span>친구들에게 보이는 이름이에요</span>
          <span className="tabular-nums">{name.length} / {MAX_NAME}</span>
        </div>
      </div>

      {isCreate ? (
        <section aria-label="미리보기" className="rounded-2xl bg-white/10 p-4 text-center">
          <div className="flex items-baseline justify-between text-xs opacity-80">
            <span>미리보기</span>
            <span>장식 0개 · 친구들이 달아줘요</span>
          </div>
          <p className="font-display mt-2 text-xl">{shownName}님의 트리</p>
          <div className="mx-auto mt-2 max-w-[260px]">
            <TreeScene theme="classic" ornaments={[]} season={season} />
          </div>
        </section>
      ) : (
        currentTitle && (
          <div className="card px-4 py-3.5">
            <p className="text-xs text-slate-500">지금 이름</p>
            <p className="font-display text-lg">{currentTitle}</p>
          </div>
        )
      )}

      {isCreate ? (
        <div className="flex flex-col gap-2.5">
          <button className="btn btn-primary w-full text-lg" disabled={pending}>{pending ? "만드는 중…" : "🎄 트리 만들기"}</button>
          <p className="text-center text-sm opacity-80">다 만들면 링크를 인스타 스토리에 올려 친구들을 불러요</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Link href="/me" className="btn btn-light">취소</Link>
          <button className="btn btn-primary" disabled={pending}>{pending ? "저장하는 중…" : "저장"}</button>
        </div>
      )}
    </form>
  );
}
