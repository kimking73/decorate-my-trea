"use client";
import { useState } from "react";
import Toast from "@/components/Toast";

// /admin 교수님 목록: 교수님 비밀 열람 링크 보기·복사 (spec.md 4.6, T9). 링크 만들기·다시 만들기 폼은 페이지에 있다
export default function ReadLinkBox({ url, name }: { url: string; name: string }) {
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const say = (text: string) => setToast((t) => ({ text, n: (t?.n ?? 0) + 1 }));

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      say("열람 링크를 복사했어요");
    } catch {
      say("복사하지 못했어요. 주소를 길게 눌러 복사해 주세요");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly value={url} aria-label={`${name} 열람 링크`} onFocus={(e) => e.currentTarget.select()}
        className="min-h-11 min-w-0 flex-1 rounded-xl bg-slate-100 px-3 text-xs text-slate-700"
      />
      <button type="button" onClick={copy} className="btn btn-primary shrink-0 !px-3 !py-2 text-sm">링크 복사</button>
      <Toast key={toast?.n ?? 0} message={toast?.text ?? null} />
    </div>
  );
}
