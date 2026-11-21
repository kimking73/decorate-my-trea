"use client";
import { startTransition, useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";

// 12/25 0시에 열어 둔 화면이 모두 같은 순간 서버에 요청하지 않도록 흩는다 (spec.md 4.5).
// 공개 시각 + 무작위 대기 후 router.refresh() 한 번. 새 화면이 아직 공개 전이면 점점 길게
// (각자 무작위 가감) 다시 시도한다. 열람 권한은 DB가 판단한다 — 여기서는 요청 시각만 정한다.
//
// router.refresh()가 실패하면 Next.js는 이 훅에 알려 주지 않는다:
// - 500·네트워크 오류 → 같은 주소를 브라우저 새로 고침으로 다시 연다 (이 훅이 사라짐)
// - 페이지가 throw → app/error.tsx가 트리 화면을 대신한다 (이 훅이 사라짐)
// 그래서 진행 상황을 sessionStorage에 남기고, 다시 연 트리 화면이나 error.tsx
// (useRevealErrorRecovery)가 이어서 재시도한다.

const RETRY_MS = [2_000, 4_000, 8_000, 16_000]; // n번째 요청이 안 열렸을 때 다음 요청까지 (0.5~1.5배)
const MAX_ATTEMPTS = RETRY_MS.length + 1; // 처음 1번 + 재시도 4번
const LATE_WINDOW_MS = 10 * 60_000; // 공개 후 10분이 지나 처음 연 화면은 건드리지 않음 (?dday 미리보기 등)
const MAX_TIMEOUT_MS = 2_147_483_647; // setTimeout 최대값 (약 24.8일)
const STORAGE_KEY = "postech-tree:reveal-refresh";

export type RevealPhase = "idle" | "opening" | "failed";

type Progress = { at: number; attempt: number };

// sessionStorage가 막힌 브라우저(일부 인앱·사생활 보호 모드)에서는 이 화면 안에서만 기억한다.
let memoryProgress: Progress | null = null;

function readProgress(): Progress | null {
  let p: unknown = memoryProgress;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    p = raw ? JSON.parse(raw) : null;
  } catch {}
  const v = p as Progress | null;
  return v && Number.isFinite(v.at) && Number.isInteger(v.attempt) && v.attempt > 0 ? v : null;
}

function writeProgress(p: Progress | null) {
  memoryProgress = p;
  try {
    if (p) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const jittered = (base: number) => base / 2 + Math.random() * base;

/** 다음 요청까지 기다릴 시간. 이미 보낸 요청 수(attempt ≥ 1) 기준 */
const retryDelay = (attempt: number) => jittered(RETRY_MS[Math.min(attempt, RETRY_MS.length) - 1]);

/**
 * 트리 화면용. 공개 전 화면이면 공개 시각 + 0~maxJitterMs 뒤 새로 고친다.
 * phase: idle(공개 전·이미 공개) · opening(공개 시각이 지나 꺼내는 중) · failed(재시도를 다 씀)
 * retry: failed일 때 사람이 누르는 "다시 시도"
 */
export function useRevealRefresh(revealAt: string, revealed: boolean, maxJitterMs: number) {
  const router = useRouter();
  const at = new Date(revealAt).getTime();
  const [pending, startRefresh] = useTransition();
  const attemptRef = useRef(0);
  const [sent, setSent] = useState(0); // 이 탭에서 보낸 요청 수 (다시 연 화면은 이어받음)
  const [due, setDue] = useState(false); // 공개 시각이 지났는지 (무작위 대기 중 포함)

  const fire = useCallback(() => {
    const n = attemptRef.current + 1;
    attemptRef.current = n;
    writeProgress({ at, attempt: n });
    setSent(n);
    // 앞 요청이 끝날 때까지 pending이 true라, 다음 재시도는 그 뒤에 잡힌다 (요청이 겹치지 않음)
    startRefresh(() => router.refresh());
  }, [at, router]);

  // 첫 요청 예약 (또는 브라우저 새로 고침으로 다시 열린 화면이면 이어받기)
  useEffect(() => {
    if (!Number.isFinite(at)) return;
    if (revealed) {
      if (readProgress()?.at === at) writeProgress(null);
      return;
    }
    const resumed = readProgress();
    if (resumed && resumed.at === at && Date.now() <= at + LATE_WINDOW_MS) {
      attemptRef.current = resumed.attempt;
      setSent(resumed.attempt);
      setDue(true);
      return; // 다음 요청은 아래 재시도 effect가 잡는다
    }
    if (Date.now() > at + LATE_WINDOW_MS) return;

    const jitter = Math.random() * maxJitterMs; // 화면마다 한 번만 뽑는다 (탭을 오가도 내 차례는 그대로)
    let dueTimer: ReturnType<typeof setTimeout> | undefined;
    let fireTimer: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      clearTimeout(dueTimer);
      clearTimeout(fireTimer);
      const left = at - Date.now();
      if (left > MAX_TIMEOUT_MS) {
        dueTimer = setTimeout(schedule, MAX_TIMEOUT_MS); // 25일 넘게 열어 둔 화면
        return;
      }
      dueTimer = setTimeout(() => setDue(true), Math.max(0, left));
      fireTimer = setTimeout(fire, Math.max(0, left + jitter));
    }

    // 백그라운드 탭·절전 중에는 타이머가 늦게 돌므로, 다시 보일 때 남은 시간을 새로 잡는다 (재시도 중이면 그대로)
    function onVisible() {
      if (document.visibilityState === "visible" && attemptRef.current === 0) schedule();
    }

    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(dueTimer);
      clearTimeout(fireTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [at, revealed, maxJitterMs, fire]);

  // 요청이 끝났는데 아직 공개 전 화면이면 다음 재시도
  useEffect(() => {
    if (revealed || pending || sent === 0 || sent >= MAX_ATTEMPTS) return;
    const t = setTimeout(fire, retryDelay(sent));
    return () => clearTimeout(t);
  }, [sent, pending, revealed, fire]);

  const phase: RevealPhase =
    revealed || !due ? "idle" : sent >= MAX_ATTEMPTS && !pending ? "failed" : "opening";
  return { phase, retry: fire };
}

/**
 * app/error.tsx용. 공개 순간 새로 고침이 서버 오류로 오류 화면이 됐을 때, 같은 간격으로
 * router.refresh() + reset()을 다시 한다. 공개 재시도 중이 아니면 아무것도 하지 않는다.
 * 반환값이 "opening"이면 오류 대신 "꺼내는 중"을 보여 준다.
 */
export function useRevealErrorRecovery(reset: () => void): RevealPhase {
  const router = useRouter();
  // 서버에서 그린 오류 화면(브라우저 새로 고침 뒤)은 "idle"로 그렸다가 hydration 뒤 바로 바뀐다
  const phase = useSyncExternalStore(noSubscribe, errorRecoveryPhase, () => "idle" as const);

  useEffect(() => {
    const p = readProgress();
    if (!p || errorRecoveryPhase() !== "opening") return;
    const t = setTimeout(() => {
      writeProgress({ at: p.at, attempt: p.attempt + 1 });
      // 다시 실패하면 error.tsx가 새로 그려지며 이 effect가 다음 시도를 잡는다
      startTransition(() => {
        router.refresh();
        reset();
      });
    }, retryDelay(p.attempt));
    return () => clearTimeout(t);
  }, [reset, router]);

  return phase;
}

const noSubscribe = () => () => {};

function errorRecoveryPhase(): RevealPhase {
  const p = readProgress();
  if (!p || Date.now() > p.at + LATE_WINDOW_MS) return "idle";
  return p.attempt >= MAX_ATTEMPTS ? "failed" : "opening";
}
