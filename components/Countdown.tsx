"use client";
import { useEffect, useState } from "react";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  return {
    done: ms === 0,
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms / 3_600_000) % 24),
    m: Math.floor((ms / 60_000) % 60),
    s: Math.floor((ms / 1000) % 60),
  };
}

export default function Countdown({ target, compact = false }: { target: string; compact?: boolean }) {
  const t = new Date(target).getTime();
  const [v, setV] = useState<ReturnType<typeof diff> | null>(null);

  useEffect(() => {
    setV(diff(t));
    const id = setInterval(() => setV(diff(t)), 1000);
    return () => clearInterval(id);
  }, [t]);

  if (!v) return <div className={compact ? "h-6" : "h-16"} />;
  if (v.done) return <p className="font-display text-xl">🎅 메리 크리스마스! 편지가 열렸어요</p>;

  if (compact) return <span className="font-display">D-{v.d + (v.h || v.m || v.s ? 1 : 0)}</span>;

  const box = (n: number, label: string) => (
    <div className="flex w-16 flex-col items-center rounded-2xl bg-white/15 py-2 backdrop-blur">
      <span className="font-display text-2xl tabular-nums">{String(n).padStart(2, "0")}</span>
      <span className="text-[11px] opacity-80">{label}</span>
    </div>
  );
  return (
    <div className="flex justify-center gap-2" aria-label="크리스마스까지 남은 시간">
      {box(v.d, "일")}{box(v.h, "시간")}{box(v.m, "분")}{box(v.s, "초")}
    </div>
  );
}
