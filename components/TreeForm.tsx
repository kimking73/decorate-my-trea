"use client";
import { useActionState } from "react";
import { saveMyTree } from "@/app/actions";

export default function TreeForm({ initialName, isEdit }: { initialName: string; isEdit: boolean }) {
  const [state, action, pending] = useActionState(saveMyTree, undefined);

  return (
    <form action={action} className="card flex flex-col gap-4 p-5">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">친구들에게 보일 내 이름</span>
        <input name="owner_name" required maxLength={20} defaultValue={initialName} placeholder="예: 포닉스"
          className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#c8102e]" />
        <span className="text-xs text-slate-500">트리 이름은 &lsquo;OO님의 트리&rsquo;로 만들어져요.</span>
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "저장 중..." : isEdit ? "저장하기" : "🎄 트리 만들기"}</button>
    </form>
  );
}
