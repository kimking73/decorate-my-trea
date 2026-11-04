"use client";
import { useActionState } from "react";
import { adminCreateSpecialTree } from "@/app/actions";
import { THEMES } from "@/lib/constants";

export default function AdminCreateForm() {
  const [state, action, pending] = useActionState(adminCreateSpecialTree, undefined);
  const input = "rounded-xl border border-slate-200 px-3 py-2";
  return (
    <form action={action} className="flex flex-col gap-2">
      <select name="kind" className={input}><option value="professor">👨‍🏫 교수님 트리</option><option value="special">✨ 특별 트리 (학생회 등)</option></select>
      <input name="title" required maxLength={30} placeholder="트리 제목 (예: 김OO 교수님께)" className={input} />
      <input name="owner_name" required maxLength={20} placeholder="표시 이름 (예: 김OO 교수님)" className={input} />
      <input name="slug" placeholder="주소 (예: prof-kim, 비우면 자동)" className={input} />
      <textarea name="description" maxLength={200} placeholder="소개 문구" className={input} />
      <select name="theme" defaultValue="chalkboard" className={input}>
        {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
      </select>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>만들기</button>
    </form>
  );
}
