"use client";
import { useState } from "react";
import Toast from "@/components/Toast";

// 홈·내 페이지의 트리 링크 공유 (스토리 이미지 저장은 트리 화면의 ShareButtons에서만)
// variant "single": "내 트리 링크 공유하기" 하나 (홈) · "pair": "링크 복사" + "공유하기" (내 페이지)
export default function ShareLinkButtons({ url, title, variant }: { url: string; title: string; variant: "single" | "pair" }) {
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const say = (text: string) => setToast((t) => ({ text, n: (t?.n ?? 0) + 1 }));

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      say("링크를 복사했어요");
    } catch {
      say("복사하지 못했어요. 주소를 길게 눌러 복사해 주세요");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: "내 트리에 편지를 달아줘! 🎄", url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // 사용자가 공유 시트를 닫음
      }
    }
    await copy();
  }

  return (
    <>
      {variant === "single" ? (
        <button type="button" className="btn btn-light w-full" onClick={share}>🔗 내 트리 링크 공유하기</button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-light !px-3" onClick={copy}>링크 복사</button>
          <button type="button" className="btn btn-light !px-3" onClick={share}>공유하기</button>
        </div>
      )}
      {/* key로 같은 문구도 다시 띄운다 */}
      <Toast key={toast?.n ?? 0} message={toast?.text ?? null} />
    </>
  );
}
