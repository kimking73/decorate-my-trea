"use client";
import { useActionState } from "react";
import { adminCreateSpecialTree } from "@/app/actions";

// 교수님 트리만 만든다 (특별 트리는 화면에서 만들지 않음, spec.md 3장)
// TODO(서버): 학과 선택은 adminCreateSpecialTree가 department를 받으면 추가, 허락 대기로 생성은 0003 이후
export default function AdminCreateForm() {
  const [state, action, pending] = useActionState(adminCreateSpecialTree, undefined);
  const input = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-[15px] text-slate-900";
  const label = "text-sm font-bold";
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="kind" value="professor" />
      {state?.error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700">{state.error}</div>
      )}
      {state && !state.error && <p role="status" className="rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-800">교수님 트리를 만들었어요</p>}

      <label htmlFor="t-title" className={label}>트리 이름</label>
      <input id="t-title" name="title" required maxLength={30} placeholder="OO 교수님께 드리는 트리" className={input} />
      <label htmlFor="t-owner" className={`${label} mt-1`}>주인 이름</label>
      <input id="t-owner" name="owner_name" required maxLength={20} placeholder="예: OO 교수님" className={input} />
      <label htmlFor="t-desc" className={`${label} mt-1`}>설명</label>
      <textarea id="t-desc" name="description" maxLength={200} placeholder="홈 카드에 보이는 한 줄 설명" className={`${input} min-h-22 py-2.5`} />
      <label htmlFor="t-theme" className={`${label} mt-1`}>테마</label>
      <select id="t-theme" name="theme" defaultValue="chalkboard" className={input}>
        <option value="chalkboard">칠판</option>
        <option value="classic">기본</option>
      </select>

      <button className="btn btn-primary mt-3 w-full" disabled={pending}>{pending ? "만드는 중…" : "만들기"}</button>
    </form>
  );
}
