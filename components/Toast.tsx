"use client";
import { useEffect, useState } from "react";

const SHOW_MS = 2500;

type Shown = { text: string; seq: number };

/**
 * 화면 아래 짧은 알림 (spec.md 5.1 공통 상태).
 * - 받은 message를 이 컴포넌트 상태로 붙잡아 2.5초 보여 준다. 그 사이 message가 null로 바뀌어도 그대로 둔다.
 * - 타이머는 "보여 준 알림"에만 묶여 있어 부모가 다시 그려져도 늘어나거나 끊기지 않는다.
 * - 같은 문구를 다시 띄우려면 seq를 바꾼다 (예: 같은 오류가 연달아 날 때).
 * - clearQuery: ?toast= 로 받은 알림이면 보여 준 직후 주소에서 한 번 지운다 (새로고침·뒤로 가기에 다시 뜨지 않게).
 */
export default function Toast({ message, seq = 0, clearQuery = false }: {
  message: string | null;
  seq?: number;
  clearQuery?: boolean;
}) {
  const [shown, setShown] = useState<Shown | null>(() => (message ? { text: message, seq } : null));
  // 직전 prop. 바뀐 순간에만 새 알림으로 받는다 (React 문서의 "이전 렌더 값 저장" 방식, effect 없이 렌더 중 갱신)
  const [prev, setPrev] = useState({ message, seq });
  if (prev.message !== message || prev.seq !== seq) {
    setPrev({ message, seq });
    if (message) setShown({ text: message, seq });
  }

  // 새 알림(객체)이 뜰 때마다 2.5초 타이머를 새로 건다
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [shown]);

  useEffect(() => {
    if (!shown || !clearQuery) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("toast")) return;
    url.searchParams.delete("toast");
    // router.replace는 서버에서 페이지를 다시 받아와 loading.tsx가 깜빡이므로 쓰지 않는다.
    // Next.js App Router 문서 방식: replaceState(null, …) 은 라우터와 동기화된다 (서버 재요청 없음)
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [shown, clearQuery]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {shown && (
        <div key={`${shown.seq}:${shown.text}`} role="status" className="pop-in rounded-full bg-black/80 px-4 py-2.5 text-sm text-white shadow-lg">
          {shown.text}
        </div>
      )}
    </div>
  );
}
