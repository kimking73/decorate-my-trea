"use client";
import { useActionState, useState } from "react";
import { saveMyTree } from "@/app/actions";
import { DEPARTMENTS, THEMES, USER_THEMES } from "@/lib/constants";

type Initial = { title: string; owner_name: string; theme: string; department: string | null; show_in_ranking: boolean } | null;

export default function TreeForm({ initial, defaultName }: { initial: Initial; defaultName: string }) {
  const [state, action, pending] = useActionState(saveMyTree, undefined);
  const [theme, setTheme] = useState(initial?.theme ?? "classic");

  return (
    <form action={action} className="card flex flex-col gap-4 p-5">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">트리 이름</span>
        <input name="title" required maxLength={30} defaultValue={initial?.title ?? "메리 크리스마스 🎄"}
          className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#c8102e]" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">친구들에게 보일 내 이름</span>
        <input name="owner_name" required maxLength={20} defaultValue={initial?.owner_name ?? defaultName}
          className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#c8102e]" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">학과 <span className="font-normal text-slate-500">(학과 장식이 먼저 보여요)</span></span>
        <select name="department" defaultValue={initial?.department ?? ""} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <option value="">선택 안 함</option>
          {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-bold">트리 테마</legend>
        <input type="hidden" name="theme" value={theme} />
        <div className="grid grid-cols-5 gap-2">
          {USER_THEMES.map((t) => (
            <button type="button" key={t} onClick={() => setTheme(t)}
              className={`flex flex-col items-center gap-1 rounded-xl p-1 text-[11px] ${theme === t ? "ring-3 ring-[#c8102e]" : ""}`}>
              <span className="h-10 w-10 rounded-full border border-slate-200" style={{ background: THEMES[t].bg }} />
              {THEMES[t].name}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="show_in_ranking" defaultChecked={initial?.show_in_ranking ?? true} className="h-4 w-4" />
        인기 트리 랭킹에 내 트리 이름 보이기
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "저장 중..." : initial ? "저장하기" : "🎄 트리 만들기"}</button>
    </form>
  );
}
