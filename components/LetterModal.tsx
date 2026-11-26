"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { findOrnament } from "@/lib/constants";

export type Letter = {
  id: string;
  ornament_type: string;
  nickname: string;
  content: string;
  is_confession: boolean;
  created_at: string;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 편지 창. 열면 포커스를 창 안으로 옮기고 Tab 을 가두며, 닫으면 열었던 장식으로 포커스를 돌려준다 (spec.md 4.2 접근성) */
export default function LetterModal({
  letter, onClose, onReport,
}: { letter: Letter; onClose: () => void; onReport?: (id: string) => void }) {
  const [opened, setOpened] = useState(false);
  const orn = findOrnament(letter.ornament_type);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setOpened(true), 450);
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // 연 버튼 기억 → 창으로 포커스 → 닫히면 되돌리기 (신고로 장식이 사라졌으면 되돌리지 않는다)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);

  // 봉투가 펼쳐지면 "닫기"로
  useEffect(() => {
    if (opened) closeRef.current?.focus({ preventScroll: true });
  }, [opened]);

  function trapTab(e: KeyboardEvent) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  const date = new Date(letter.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${letter.nickname}의 편지`}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="w-full max-w-sm outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {!opened ? (
          <div className="pop-in mx-auto grid h-48 w-72 place-items-center rounded-2xl bg-[#f6e3c4] text-6xl shadow-2xl">
            <span aria-hidden>✉️</span>
            <span className="sr-only">편지 봉투를 여는 중</span>
          </div>
        ) : (
          <div className="pop-in card max-h-[80dvh] overflow-y-auto p-6"
            style={letter.is_confession ? { background: "#fff0f5" } : { background: "#fffaf0" }}>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-full text-xl" style={{ background: orn.bg }} aria-hidden>{orn.emoji}</span>
              <div>
                <h2 className="font-display text-lg">From. {letter.nickname}</h2>
                {letter.is_confession && <p className="text-xs text-pink-700"><span aria-hidden>💘 </span>고백 편지</p>}
              </div>
            </div>
            <p className="whitespace-pre-wrap break-words text-[15px] leading-7"
              style={{ backgroundImage: "repeating-linear-gradient(transparent 0 27px, #e8dcc8 27px 28px)" }}>
              {letter.content}
            </p>
            <p className="mt-4 text-right text-xs text-slate-600">{date}에 달린 편지</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              {onReport ? (
                <button type="button" className="min-h-11 px-1 text-xs text-slate-600 underline" onClick={() => {
                  if (confirm("이 편지를 숨기고 신고할까요?")) onReport(letter.id);
                }}>신고/숨기기</button>
              ) : <span />}
              <button ref={closeRef} type="button" className="btn btn-primary min-h-11 !py-2" onClick={onClose}>닫기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
