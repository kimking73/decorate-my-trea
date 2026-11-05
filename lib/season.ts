// 12/1 → 12/25 진행도. 전구는 하루에 하나씩 켜진다.
export const TOTAL_BULBS = 24;
const DAY = 86_400_000;

export type Season = {
  progress: number; // 0 ~ 1
  bulbsOn: number; // 0 ~ 24
  daysLeft: number; // 공개까지 남은 일수(올림)
  revealed: boolean;
  started: boolean; // 12/1 이 지났는지
};

export function getSeason(now: number, revealAt: Date, forcedDaysLeft?: number | null): Season {
  const end = revealAt.getTime();
  const start = end - TOTAL_BULBS * DAY;
  const t = forcedDaysLeft != null ? end - forcedDaysLeft * DAY : now;
  const revealed = t >= end;
  const progress = Math.min(1, Math.max(0, (t - start) / (end - start)));
  const daysLeft = Math.max(0, Math.ceil((end - t) / DAY));
  // 12/1 에 첫 전구 1개, 12/24 에 24개
  const bulbsOn = revealed ? TOTAL_BULBS : t < start ? 0 : Math.min(TOTAL_BULBS, Math.floor((t - start) / DAY) + 1);
  return { progress, bulbsOn, daysLeft, revealed, started: t >= start };
}

/** ?dday=N 미리보기 — 개발/데모 모드에서만 허용 */
export function parseForcedDday(raw: string | undefined, allow: boolean): number | null {
  if (!allow || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 60 ? n : null;
}
