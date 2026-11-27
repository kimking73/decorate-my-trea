"use client";
import { useActionState } from "react";
import { adminUpdateSpecialTree } from "@/app/actions";
import { DEPARTMENTS, THEMES } from "@/lib/constants";

// /admin "교수님 목록"의 "정보 수정" (spec.md 3장, 0007).
// 주소(slug)는 바꿀 수 없다 — 교수님 열람 링크가 /t/<slug>?key=… 라서 주소가 바뀌면 링크가 깨진다.
export default function AdminEditForm({ tree, filter }: {
  tree: { id: string; title: string; owner_name: string; theme: string; department: string | null; description: string | null };
  filter: string;
}) {
  const [state, action, pending] = useActionState(adminUpdateSpecialTree, undefined);
  const input = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[15px] text-slate-900";
  const label = "text-sm font-bold";
  const uid = (name: string) => `edit-${name}-${tree.id}`;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="tree_id" value={tree.id} />
      <input type="hidden" name="filter" value={filter} />
      {state?.error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700">{state.error}</div>
      )}
      {/* 저장하면 adminUpdateSpecialTree 가 /admin?tab=list&toast=updated 로 이동하므로 여기서는 오류만 보여 준다 */}

      <label htmlFor={uid("title")} className={label}>트리 이름</label>
      <input id={uid("title")} name="title" required maxLength={30} defaultValue={tree.title} className={input} />
      <label htmlFor={uid("owner")} className={`${label} mt-1`}>주인 이름</label>
      <input id={uid("owner")} name="owner_name" required maxLength={20} defaultValue={tree.owner_name} className={input} />
      <label htmlFor={uid("desc")} className={`${label} mt-1`}>설명</label>
      <textarea id={uid("desc")} name="description" maxLength={200} defaultValue={tree.description ?? ""} className={`${input} min-h-20 py-2.5`} />
      <div className="mt-1 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={uid("theme")} className={label}>테마</label>
          <select id={uid("theme")} name="theme" defaultValue={tree.theme} className={input}>
            {Object.entries(THEMES).map(([id, t]) => (
              <option key={id} value={id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={uid("dept")} className={label}>학과</label>
          <select id={uid("dept")} name="department" defaultValue={tree.department ?? ""} className={input}>
            <option value="">선택 안 함</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn btn-primary mt-2 w-full" disabled={pending}>{pending ? "저장 중…" : "저장"}</button>
    </form>
  );
}
