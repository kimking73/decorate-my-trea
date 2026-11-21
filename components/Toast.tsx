"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/** 화면 아래 짧은 알림 (spec.md 5.1 공통 상태). message가 바뀔 때마다 다시 보여 주고 잠시 뒤 사라진다. */
export default function Toast({ message, clearQuery = false }: { message: string | null; clearQuery?: boolean }) {
  const [shown, setShown] = useState(message);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setShown(message);
    if (!message) return;
    // ?toast= 로 받은 알림은 새로고침·뒤로 가기에 다시 뜨지 않게 주소에서 지운다
    if (clearQuery) router.replace(pathname, { scroll: false });
    const t = setTimeout(() => setShown(null), 2500);
    return () => clearTimeout(t);
  }, [message, clearQuery, pathname, router]);

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
