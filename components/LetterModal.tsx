"use client";
import { useEffect, useState } from "react";
import { findOrnament } from "@/lib/constants";

export type Letter = {
  id: string;
  ornament_type: string;
  nickname: string;
  content: string;
  is_confession: boolean;
  created_at: string;
};

export default function LetterModal({
  letter, onClose, onReport,
}: { letter: Letter; onClose: () => void; onReport?: (id: string) => void }) {
  const [opened, setOpened] = useState(false);
  const orn = findOrnament(letter.ornament_type);

  useEffect(() => {
    const t = setTimeout(() => setOpened(true), 450);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal>
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {!opened ? (
          <div className="pop-in mx-auto grid h-48 w-72 place-items-center rounded-2xl bg-[#f6e3c4] text-6xl shadow-2xl">
            ✉️
          </div>
        ) : (
          <div className="pop-in card max-h-[80dvh] overflow-y-auto p-6"
            style={letter.is_confession ? { background: "#fff0f5" } : { background: "#fffaf0" }}>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-full text-xl" style={{ background: orn.bg }}>{orn.emoji}</span>
              <div>
                <p className="font-display text-lg">From. {letter.nickname}</p>
                {letter.is_confession && <p className="text-xs text-pink-600">💘 고백 편지</p>}
              </div>
            </div>
            <p className="whitespace-pre-wrap break-words text-[15px] leading-7"
              style={{ backgroundImage: "repeating-linear-gradient(transparent 0 27px, #e8dcc8 27px 28px)" }}>
              {letter.content}
            </p>
            <p className="mt-4 text-right text-xs text-slate-500">
              {new Date(letter.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}에 달린 편지
            </p>
            <div className="mt-4 flex justify-between gap-2">
              {onReport ? (
                <button className="text-xs text-slate-400 underline" onClick={() => {
                  if (confirm("이 편지를 숨기고 신고할까요?")) onReport(letter.id);
                }}>신고/숨기기</button>
              ) : <span />}
              <button className="btn btn-primary !py-2" onClick={onClose}>닫기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
