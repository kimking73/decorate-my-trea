"use client";
import { useState, type RefObject } from "react";

export default function ShareButtons({ url, title, captureRef }: { url: string; title: string; captureRef?: RefObject<HTMLElement | null> }) {
  const [msg, setMsg] = useState<string | null>(null);
  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2000); };

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title, text: "내 트리에 편지를 달아줘! 🎄", url }); return; } catch { /* 취소 */ }
    }
    await navigator.clipboard.writeText(url);
    say("링크를 복사했어요! 인스타 스토리 링크 스티커에 붙여넣어 주세요 🔗");
  }

  async function saveImage() {
    if (!captureRef?.current) return;
    const { toPng } = await import("html-to-image");
    try {
      const dataUrl = await toPng(captureRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "my-christmas-tree.png";
      a.click();
      say("이미지를 저장했어요! 스토리에 올려보세요 📸");
    } catch {
      say("이미지 저장에 실패했어요. 화면을 캡처해주세요!");
    }
  }

  return (
    <div className="relative flex w-full flex-col gap-2">
      <button className="btn btn-primary w-full" onClick={share}>🔗 내 트리 링크 공유하기</button>
      {captureRef && <button className="btn btn-light w-full" onClick={saveImage}>📸 스토리용 이미지 저장</button>}
      {msg && <p className="pop-in text-center text-sm">{msg}</p>}
    </div>
  );
}
