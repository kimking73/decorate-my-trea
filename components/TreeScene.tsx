"use client";
import { useEffect, useRef, useState } from "react";
import { findOrnament, THEMES, type ThemeId } from "@/lib/constants";

export type SceneOrnament = {
  id: string;
  ornament_type: string;
  nickname: string;
  is_confession: boolean;
  isNew?: boolean;
};

// SVG 좌표(300x360) 기준 장식 슬롯. 위→아래 순서로 채운다.
const SLOTS: [number, number][] = [
  // 트리 전체에 고르게 퍼지도록 섞인 순서로 채운다
  [150, 92], [104, 290], [196, 290], [150, 205], [112, 168], [188, 168],
  [60, 300], [240, 300], [100, 222], [200, 222], [150, 300],
  [130, 255], [172, 255], [86, 262], [214, 262], [124, 128], [176, 128], [150, 168],
];
export const SLOTS_PER_PAGE = SLOTS.length;

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

type Props = {
  theme: string;
  ornaments: SceneOrnament[];
  onOrnamentClick?: (o: SceneOrnament) => void;
  page?: number;
  starMode?: "normal" | "aplus";
  crying?: boolean;
  lockedIcons?: boolean;
};

export default function TreeScene({ theme, ornaments, onOrnamentClick, page = 0, starMode = "normal", crying, lockedIcons }: Props) {
  const [konami, setKonami] = useState(false);
  const [starClicks, setStarClicks] = useState(0);
  const [sleigh, setSleigh] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const keys = useRef<string[]>([]);
  const starTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const themeId = (konami ? "postech" : theme) as ThemeId;
  const th = THEMES[themeId] ?? THEMES.classic;

  // 코나미 코드 → 포스텍 레드 트리
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      keys.current = [...keys.current, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length);
      if (keys.current.join() === KONAMI.join()) {
        setKonami((k) => !k);
        flash("🦁 히든 테마: 포스텍 레드 발동!");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // 별 7번 연타 → 산타 썰매 + 눈폭풍
  function onStar() {
    const n = starClicks + 1;
    setStarClicks(n);
    if (starTimer.current) clearTimeout(starTimer.current);
    starTimer.current = setTimeout(() => setStarClicks(0), 1500);
    if (n >= 7) {
      setStarClicks(0);
      setSleigh(true);
      window.dispatchEvent(new Event("snowstorm"));
      flash("🎅 호호호! 산타가 지나갔어요");
      setTimeout(() => setSleigh(false), 4600);
    }
  }

  const visible = ornaments.slice(page * SLOTS_PER_PAGE, (page + 1) * SLOTS_PER_PAGE);

  return (
    <div className="relative mx-auto aspect-[300/360] w-full max-w-[380px] select-none">
      <svg viewBox="0 0 300 360" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity=".25" />
          </filter>
        </defs>
        <rect x="132" y="315" width="36" height="40" rx="4" fill="#7a4b2a" />
        <g filter="url(#soft)">
          <path d="M150 170 L285 322 Q150 338 15 322 Z" fill={th.tree[0]} />
          <path d="M150 92 L255 232 Q150 248 45 232 Z" fill={th.tree[1]} />
          <path d="M150 32 L220 132 Q150 146 80 132 Z" fill={th.tree[2]} />
        </g>
        {/* 가랜드 */}
        <path d="M88 125 Q150 150 212 122" stroke="#ffd36b" strokeWidth="2" fill="none" strokeDasharray="2 6" strokeLinecap="round" />
        <path d="M60 222 Q150 260 240 220" stroke="#ffd36b" strokeWidth="2" fill="none" strokeDasharray="2 6" strokeLinecap="round" />
        <path d="M30 312 Q150 345 270 310" stroke="#ffd36b" strokeWidth="2" fill="none" strokeDasharray="2 6" strokeLinecap="round" />
      </svg>

      {/* 꼭대기 별 (이스터에그) */}
      <button
        type="button"
        onClick={onStar}
        aria-label="트리 꼭대기 별"
        className={`twinkle absolute left-1/2 top-[1%] -translate-x-1/2 text-4xl transition-transform ${starClicks ? "scale-110" : ""}`}
      >
        {starMode === "aplus" ? "🅰️" : "⭐"}
      </button>

      {visible.map((o, i) => {
        const [x, y] = SLOTS[i];
        const orn = findOrnament(o.ornament_type);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onOrnamentClick?.(o)}
            className={`absolute flex w-[15%] -translate-x-1/2 -translate-y-1/2 flex-col items-center ${o.isNew ? "pop-in" : ""}`}
            style={{ left: `${(x / 300) * 100}%`, top: `${(y / 360) * 100}%` }}
            aria-label={`${o.nickname}의 ${orn.label} 장식`}
          >
            <span
              className={`ornament-sway relative grid aspect-square w-[66%] place-items-center rounded-full border-2 border-white/80 text-[clamp(13px,4.2vw,19px)] shadow-md ${crying ? "cry" : ""}`}
              style={{ background: orn.bg, animationDelay: `${(i % 5) * 0.3}s` }}
            >
              {crying ? "😭" : orn.emoji}
              {lockedIcons && <span className="absolute -bottom-1 -right-1 text-[10px]">🔒</span>}
            </span>
            <span
              className="mt-0.5 max-w-[130%] truncate rounded-full bg-black/40 px-1 text-[9px] leading-[14px] text-white"
            >
              {o.nickname}
            </span>
          </button>
        );
      })}

      {sleigh && (
        <div className="sleigh pointer-events-none fixed left-0 top-[18%] z-50 text-5xl">🦌🦌🛷🎅</div>
      )}
      {toast && (
        <div className="pop-in pointer-events-none absolute inset-x-0 top-1/3 z-40 mx-auto w-max max-w-[90%] rounded-full bg-black/70 px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </div>
  );
}

export function themeBackground(theme: string) {
  const th = THEMES[theme as ThemeId] ?? THEMES.classic;
  return { background: th.bg, color: th.text };
}
