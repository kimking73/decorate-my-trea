"use client";
import { useActionState } from "react";
import { claimTree } from "@/app/actions";

export default function ClaimForm() {
  const [state, action, pending] = useActionState(claimTree, undefined);
  return (
    <form action={action} className="flex gap-2">
      <input name="code" placeholder="초대 코드" className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2" />
      <button className="btn btn-primary !py-2" disabled={pending}>확인</button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
