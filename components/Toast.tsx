"use client";
import { useEffect, useState } from "react";

/** 화면 아래 짧은 알림 (spec.md 5.1 공통 상태). message가 바뀔 때마다 다시 보여 주고 잠시 뒤 사라진다. */
export default function Toast({ message, clearQuery = false }: { message: string | null; clearQuery?: boolean }) {
  const [shown, setShown] = useState(message);

  useEffect(() => {
    // message가 null로 바뀌어도 떠 있는 알림은 지우지 않는다 (2.5초 타이머가 지운다)
    if (!message) return;
    setShown(message);
    if (clearQuery) {
      // ?toast= 로 받은 알림은 새로고침·뒤로 가기에 다시 뜨지 않게 주소에서만 지운다.
      // router.replace는 서버에서 페이지를 다시 받아와 message가 null이 되고 loading.tsx가 깜빡이므로 쓰지 않는다.
      const url = new URL(window.location.href);
      url.searchParams.delete("toast");
      // Next.js App Router 문서 방식: replaceState(null, …) 은 라우터와 동기화된다 (서버 재요청 없음)
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    const t = setTimeout(() => setShown(null), 2500);
    return () => clearTimeout(t);
  }, [message, clearQuery]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {shown && (
        <div role="status" className="pop-in rounded-full bg-black/80 px-4 py-2.5 text-sm text-white shadow-lg">
          {shown}
        </div>
      )}
    </div>
  );
}
