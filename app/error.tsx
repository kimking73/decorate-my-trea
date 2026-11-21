"use client";

import Link from "next/link";
import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { useRevealErrorRecovery } from "@/components/useRevealRefresh";

// 조회 함수가 throw할 때 (DB·네트워크 오류). "없는 트리"는 not-found.tsx — spec.md 2.3 오류 계약, 5.1
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // 12/25 0시 공개 새로 고침 중에 난 오류면 "꺼내는 중"을 보여 주며 저절로 다시 시도 (spec.md 4.5, C12)
  const reveal = useRevealErrorRecovery(reset);
  // reset()만 하면 서버에서 다시 받지 않으므로 router.refresh()와 함께 (Next.js 권장)
  const retry = () => startTransition(() => { router.refresh(); reset(); });

  if (reveal === "opening") {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <p role="status" className="font-display text-xl">🎁 산타가 편지를 꺼내는 중이에요…</p>
      </main>
    );
  }
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-6xl" aria-hidden>🎄💦</p>
        <h1 className="font-display mt-4 text-2xl">잠시 문제가 생겼어요</h1>
        <p className="mt-2 text-sm opacity-80">사람이 많이 몰렸을 수 있어요. 조금 뒤에 다시 시도해 주세요.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={retry} className="btn btn-primary">다시 시도</button>
          <Link href="/" className="btn btn-ghost">홈으로</Link>
        </div>
      </div>
    </main>
  );
}
