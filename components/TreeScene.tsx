"use client";
import { useRef, useState } from "react";
import { findOrnament, isTreeColor, THEMES, TREE_COLORS, type ThemeId } from "@/lib/constants";
import { TOTAL_BULBS } from "@/lib/season";

export type SceneOrnament = {
  id: string;
  ornament_type: string;
  nickname: string;
  isNew?: boolean;
};

export type SceneSeason = { bulbsOn: number; progress: number; daysLeft: number; revealed: boolean };

// SVG 좌표(300x360) 기준 장식 슬롯. 트리 전체에 고르게 퍼지도록 섞인 순서로 채운다.
const SLOTS: [number, number][] = [
  [150, 92], [104, 290], [196, 290], [150, 205], [112, 168], [188, 168],
  [60, 300], [240, 300], [100, 222], [200, 222], [150, 300],
  [130, 255], [172, 255], [86, 262], [214, 262], [124, 128], [176, 128], [150, 168],
];
export const SLOTS_PER_PAGE = SLOTS.length;

// 트리 층 (아래 → 위로 그림): 꼭짓점 y, 밑변 y, 반폭
const TIERS = [
  { ay: 170, by: 322, hw: 135 },
  { ay: 92, by: 232, hw: 105 },
  { ay: 32, by: 132, hw: 70 },
];

// 전구 줄 (2차 베지어): 시작, 제어점, 끝
const GARLANDS: [number, number, number, number, number, number][] = [
  [88, 125, 150, 150, 212, 122],
  [60, 222, 150, 260, 240, 220],
  [30, 312, 150, 345, 270, 310],
];
const PER_GARLAND = TOTAL_BULBS / GARLANDS.length;
const BULBS = GARLANDS.flatMap(([x0, y0, cx, cy, x1, y1]) =>
  Array.from({ length: PER_GARLAND }, (_, k) => {
    const t = (k + 0.5) / PER_GARLAND;
    const u = 1 - t;
    return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1 + 3];
  }),
);
// 하루에 하나씩 켜지는 순서 — 트리 전체에 흩어지도록 (7 과 24 는 서로소)
const LIGHT_ORDER = Array.from({ length: TOTAL_BULBS }, (_, j) => (j * 7) % TOTAL_BULBS);
const BULB_COLORS = ["#ffd84d", "#ff5a6e", "#5ab0ff", "#7dff9a"];
// 전구가 놓이는 세로 구간(SVG y). 전구 묶음 레이어를 이 띠 크기로만 만들어 무지개 때 겹치는 레이어 4장의 메모리를 줄인다.
const BAND_TOP = 115;
const BAND_H = 230;

type Props = {
  theme: string;
  ornaments: SceneOrnament[];
  season: SceneSeason;
  onOrnamentClick?: (o: SceneOrnament) => void;
  starMode?: "normal" | "aplus";
  crying?: boolean;
  lockedIcons?: boolean;
  /** 트리 색 id (trees.tree_color). 없거나 모르는 id면 theme의 트리 색 (spec.md 2.2·4.7) */
  treeColor?: string | null;
};

export default function TreeScene({ theme, ornaments, season, onOrnamentClick, starMode = "normal", crying, lockedIcons, treeColor }: Props) {
  const [ponixRed, setPonixRed] = useState(false);
  const [ponixHop, setPonixHop] = useState(0);
  const [starClicks, setStarClicks] = useState(0);
  const [starBurst, setStarBurst] = useState(0);
  const [chase, setChase] = useState(false);
  const [sleigh, setSleigh] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const starTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const th = THEMES[(ponixRed ? "postech" : theme) as ThemeId] ?? THEMES.classic;
  // 포닉스 이스터에그(빨간 트리) 중에는 그 색이 우선
  const treeFill = !ponixRed && isTreeColor(treeColor) ? TREE_COLORS[treeColor].tree : th.tree;
  const p = season.progress;
  const lit = new Set(LIGHT_ORDER.slice(0, season.bulbsOn));
  const allOn = chase || season.revealed;
  const rainbow = season.revealed && !chase;
  const starGlow = season.revealed || season.daysLeft <= 7 || chase;
  const gifts = season.revealed ? 3 : Math.max(0, Math.min(3, 4 - season.daysLeft));

  const star = starMode === "aplus" ? "🅰️" : "⭐";

  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  // 별: 누를 때마다 반짝, 7연타 → 전구 전부 켜지며 체이스 + 산타 썰매
  function onStar() {
    setStarBurst((n) => n + 1);
    const n = starClicks + 1;
    setStarClicks(n);
    if (starTimer.current) clearTimeout(starTimer.current);
    starTimer.current = setTimeout(() => setStarClicks(0), 1500);
    if (n >= 7) {
      setStarClicks(0);
      setChase(true);
      setSleigh(true);
      flash("🎅 호호호! 산타가 불을 켜고 지나갔어요");
      setTimeout(() => setChase(false), 4500);
      setTimeout(() => setSleigh(false), 4600);
    }
  }

  // 포닉스: 탭하면 포스텍 레드 트리로 변신
  function onPonix() {
    setPonixHop((n) => n + 1);
    setPonixRed((r) => {
      flash(r ? "🎄 원래 트리로 돌아왔어요" : "🔥 포닉스 파워! 포스텍 레드 트리 변신!");
      return !r;
    });
  }

  return (
    <div className="relative mx-auto aspect-[300/370] w-full max-w-[380px] select-none">
      <svg viewBox="0 0 300 370" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity=".25" />
          </filter>
        </defs>

        <rect x="132" y="315" width="36" height="40" rx="4" fill="#7a4b2a" />
        {/* 바닥에 쌓이는 눈 */}
        <ellipse cx="150" cy="356" rx={70 + 80 * p} ry={3 + 12 * p} fill="#fff" opacity={0.35 + 0.6 * p} />

        <g filter="url(#soft)">
          {TIERS.map((t, i) => (
            <path key={i} d={`M150 ${t.ay} L${150 + t.hw} ${t.by} Q150 ${t.by + 16} ${150 - t.hw} ${t.by} Z`} fill={treeFill[i]} style={{ transition: "fill .6s" }} />
          ))}
        </g>

        {/* 눈 쌓임: 각 층 밑단 + 꼭대기 눈모자 */}
        {p > 0 && TIERS.map((t, i) => (
          <path key={`rim${i}`} d={`M${150 - t.hw + 4} ${t.by - 1} Q150 ${t.by + 15} ${150 + t.hw - 4} ${t.by - 1}`}
            stroke="#fff" strokeWidth={1 + 5 * p} strokeLinecap="round" fill="none" opacity={0.95} />
        ))}
        {p > 0 && (() => {
          const t = TIERS[2];
          const d = 6 + 26 * p;
          const w = (t.hw / (t.by - t.ay)) * d;
          return <path d={`M150 ${t.ay} L${150 + w} ${t.ay + d} Q${150 + w / 2} ${t.ay + d + 5} 150 ${t.ay + d - 2} Q${150 - w / 2} ${t.ay + d + 5} ${150 - w} ${t.ay + d} Z`} fill="#fff" />;
        })()}

        {/* 전구 줄 (전구는 SVG 밖, 아래 .bulbs) */}
        {GARLANDS.map(([x0, y0, cx, cy, x1, y1], i) => (
          <path key={`g${i}`} d={`M${x0} ${y0 + 3} Q${cx} ${cy + 3} ${x1} ${y1 + 3}`} stroke="#22301f" strokeWidth="1.2" fill="none" opacity=".7" />
        ))}
      </svg>

      {/* 전구. SVG 필터(feGaussianBlur) 대신 HTML + box-shadow 라서 깜빡임(opacity)은 합성 단계에서만 처리된다.
          무지개(12/25~)는 색을 한 칸씩 민 전구 묶음 4장을 겹쳐 놓고 opacity 로 번갈아 보여 준다 — 색(color)을
          직접 애니메이션하면 매 프레임 메인 스레드에서 다시 그려야 한다 (C2 측정). */}
      {(rainbow ? [0, 1, 2, 3] : [0]).map((k) => (
        <div
          key={rainbow ? `r${k}` : "b"}
          className={`pointer-events-none absolute inset-x-0 ${rainbow ? "bulbs-rainbow" : ""}`}
          style={{ top: `${(BAND_TOP / 370) * 100}%`, height: `${(BAND_H / 370) * 100}%`, animationDelay: rainbow ? `${k * 0.75 - 3}s` : undefined }}
          aria-hidden
        >
          {BULBS.map(([x, y], i) => {
            const on = allOn || lit.has(i);
            return (
              <span
                key={i}
                className={`bulb ${on ? `bulb-lit ${chase ? "bulb-chase" : rainbow ? "" : "bulb-on"}` : ""}`}
                style={{
                  left: `${(x / 300) * 100}%`, top: `${((y - BAND_TOP) / BAND_H) * 100}%`,
                  width: `${((on ? 7.6 : 6.4) / 300) * 100}%`,
                  color: on ? BULB_COLORS[(i + k) % BULB_COLORS.length] : "#59606a",
                  animationDelay: on && !rainbow ? (chase ? `${i * 0.06}s` : `${(i % 6) * 0.35}s`) : undefined,
                }}
              />
            );
          })}
        </div>
      ))}

      {/* 꼭대기 별 */}
      {/* 다시 반짝이게 하려고 바꾸는 key 는 버튼 안쪽에 둔다 — 버튼 자체가 다시 만들어지면 키보드 포커스가 사라진다 (C9) */}
      <button
        type="button"
        onClick={onStar}
        aria-label="트리 꼭대기 별 (누르면 반짝, 일곱 번 연달아 누르면 산타가 와요)"
        className={`absolute left-1/2 top-[1%] grid min-h-11 min-w-11 -translate-x-1/2 place-items-center text-4xl ${starGlow ? "" : "opacity-80"}`}
      >
        {/* 빛나는 별: 약한 빛(고정) 위에 강한 빛 복사본을 겹쳐 opacity 만 움직인다 (filter 를 애니메이션하면 매 프레임 다시 그린다) */}
        <span key={starBurst} className={`relative block ${starBurst ? "star-burst" : ""}`} aria-hidden>
          <span className={starGlow ? "twinkle" : "block"}>{star}</span>
          {starGlow && <span className="twinkle-glow">{star}</span>}
        </span>
      </button>

      {/* 장식(편지). 페이지가 바뀌면 key가 바뀌어 장식 묶음만 다시 들어온다 (.page-anim 안에서만 애니메이션). */}
      <div key={ornaments[0]?.id ?? "empty"} className="orn-page pointer-events-none absolute inset-0">
      {ornaments.slice(0, SLOTS_PER_PAGE).map((o, i) => {
        const [x, y] = SLOTS[i];
        const orn = findOrnament(o.ornament_type);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onOrnamentClick?.(o)}
            className={`pointer-events-auto absolute flex w-[15%] -translate-x-1/2 -translate-y-1/2 flex-col items-center ${o.isNew ? "pop-in" : ""}`}
            style={{ left: `${(x / 300) * 100}%`, top: `${(y / 370) * 100}%` }}
            aria-label={`${o.nickname}의 ${orn.label} 장식${lockedIcons ? ", 12월 25일에 열려요" : ""}`}
          >
            <span
              aria-hidden
              className={`ornament-sway relative grid aspect-square w-[66%] place-items-center rounded-full border-2 border-white/80 text-[clamp(13px,4.2vw,19px)] shadow-md ${crying ? "cry" : ""}`}
              style={{ background: orn.bg, animationDelay: `${(i % 5) * 0.3}s` }}
            >
              {crying ? "😭" : orn.emoji}
              {lockedIcons && <span className="absolute -bottom-1 -right-1 text-[10px]">🔒</span>}
            </span>
            <span aria-hidden className="mt-0.5 max-w-[130%] truncate rounded-full bg-black/60 px-1 text-[9px] leading-[14px] text-white">
              {o.nickname}
            </span>
          </button>
        );
      })}
      </div>

      {/* D-3 부터 선물 상자 */}
      {[[24, 91], [72, 92], [61, 94]].slice(0, gifts).map(([l, t], i) => (
        <span key={`gift${i}`} aria-hidden className="pop-in pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[clamp(20px,7vw,30px)]"
          style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.15}s` }}>
          {["🎁", "🎁", "🎀"][i]}
        </span>
      ))}

      {/* 포닉스 (탭하면 레드 트리) */}
      <button
        type="button"
        onClick={onPonix}
        aria-label={ponixRed ? "포닉스 (누르면 원래 트리로)" : "포닉스 (누르면 포스텍 레드 트리로 변신)"}
        aria-pressed={ponixRed}
        className="absolute bottom-[1%] left-[2%] min-h-11 w-[16%] min-w-11"
      >
        <span key={ponixHop} className={`block ${ponixHop ? "ponix-hop" : ""}`}><Ponix /></span>
      </button>

      {sleigh && <div aria-hidden className="sleigh pointer-events-none fixed left-0 top-[18%] z-50 text-5xl">🦌🦌🛷🎅</div>}
      {toast && (
        <div aria-hidden className="pop-in pointer-events-none absolute inset-x-0 top-1/3 z-40 mx-auto w-max max-w-[90%] rounded-full bg-black/70 px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
      {/* 스크린 리더용: 항상 붙어 있는 알림 영역이어야 새 문구를 읽는다 */}
      <p className="sr-only" role="status">{toast ?? ""}</p>
    </div>
  );
}

/** 간단한 불새 캐릭터 (포닉스 오마주, 공식 로고 아님) */
function Ponix() {
  return (
    <svg viewBox="0 0 64 64" className="h-auto w-full drop-shadow-md" aria-hidden>
      <path d="M14 40 C2 36 4 22 10 18 C10 26 14 30 18 32 Z" fill="#ff9f1c" />
      <path d="M16 44 C4 46 2 34 6 28 C8 36 14 38 20 38 Z" fill="#ffd166" />
      <ellipse cx="32" cy="40" rx="15" ry="13" fill="#e63946" />
      <path d="M24 38 C28 30 36 30 40 36 C36 34 30 36 26 42 Z" fill="#ff7b54" />
      <circle cx="40" cy="26" r="10" fill="#e63946" />
      <path d="M36 16 C36 8 42 6 44 4 C42 10 46 12 44 18 Z" fill="#ffb703" />
      <path d="M40 17 C42 11 48 10 50 8 C48 14 50 16 46 20 Z" fill="#ff9f1c" />
      <circle cx="43" cy="25" r="3" fill="#fff" />
      <circle cx="44" cy="25" r="1.6" fill="#1d1d1d" />
      <path d="M49 27 L57 29 L49 31 Z" fill="#ffb703" />
      <ellipse cx="38" cy="31" rx="2.5" ry="1.5" fill="#ff8fa3" opacity=".8" />
      <path d="M28 52 L26 58 M34 52 L35 58" stroke="#ffb703" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function themeBackground(theme: string) {
  const th = THEMES[theme as ThemeId] ?? THEMES.classic;
  return { background: th.bg, color: th.text };
}
