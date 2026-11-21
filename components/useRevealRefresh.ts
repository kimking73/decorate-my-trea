"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 12/25 0시에 열어 둔 화면이 모두 같은 순간 서버에 요청하지 않도록 흩는다 (spec.md 4.5).
// 공개 시각 + 무작위 대기 후 router.refresh() 한 번. 서버가 아직 공개 전 화면을 주거나
// 요청이 실패하면 점점 길게(각자 무작위 가감) 다시 시도한다. 열람 권한은 DB가 판단한다.

const RETRY_MS = [2_000, 4_000, 8_000, 16_000, 16_000];
const LATE_WINDOW_MS = 10 * 60_000; // 공개 후 10분이 지나 열린 화면은 건드리지 않음 (?dday 미리보기 등)
const MAX_TIMEOUT_MS = 2_147_483_647; // setTimeout 최대값 (약 24.8일)

export type RevealPhase = "idle" | "opening" | "failed";

export function useRevealRefresh(revealAt: string, revealed: boolean, maxJitterMs: number): RevealPhase {
  const router = useRouter();
  const [phase, setPhase] = useState<RevealPhase>("idle");

  useEffect(() => {
    if (revealed) return;
    const at = new Date(revealAt).getTime();
    if (!Number.isFinite(at) || Date.now() > at + LATE_WINDOW_MS) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let cancelled = false;

    function tryRefresh() {
      if (cancelled) return;
      if (attempt >= RETRY_MS.length) return setPhase("failed");
      setPhase("opening");
      router.refresh();
      // 새 화면이 공개 상태로 오면 revealed가 true가 되어 이 effect가 정리된다. 아니면 재시도.
      const base = RETRY_MS[attempt++];
      timer = setTimeout(tryRefresh, base / 2 + Math.random() * base);
    }

    function schedule() {
      clearTimeout(timer);
      const wait = Math.max(0, at - Date.now()) + Math.random() * maxJitterMs;
      if (wait > MAX_TIMEOUT_MS) return;
      timer = setTimeout(tryRefresh, wait);
    }

    // 백그라운드 탭은 타이머가 늦어지므로, 다시 보일 때 남은 시간을 새로 잡는다 (재시도 중이면 그대로)
    function onVisible() {
      if (document.visibilityState === "visible" && attempt === 0) schedule();
    }

    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [revealAt, revealed, maxJitterMs, router]);

  return revealed ? "idle" : phase;
}
