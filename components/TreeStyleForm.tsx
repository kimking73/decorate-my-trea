"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveTreeStyle } from "@/app/actions";
import TreeScene, { themeBackground, type SceneOrnament, type SceneSeason } from "@/components/TreeScene";
import { isTreeColor, THEMES, TREE_COLORS, USER_THEME_IDS, type ThemeId, type TreeColorId } from "@/lib/constants";

// 트리 색·배경 테마 고르기 + 미리보기 (spec.md 4.7). 값은 D11 전까지 임시
export default function TreeStyleForm({ initialColor, initialTheme, ornaments, season }: {
  initialColor: string | null;
  initialTheme: string;
  ornaments: SceneOrnament[];
  season: SceneSeason;
}) {
  const [state, action, pending] = useActionState(saveTreeStyle, undefined);
  const [color, setColor] = useState<TreeColorId>(isTreeColor(initialColor) ? initialColor : "green");
  const [theme, setTheme] = useState<ThemeId>(USER_THEME_IDS.includes(initialTheme as ThemeId) ? (initialTheme as ThemeId) : "classic");

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="tree_color" value={color} />
      <input type="hidden" name="theme" value={theme} />

      {state?.error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-slate-800">
          <p className="text-sm font-bold text-red-700">저장하지 못했어요</p>
          <p className="text-sm">{state.error}</p>
        </div>
      )}

      <section aria-label="미리보기" className="relative overflow-hidden rounded-2xl" style={themeBackground(theme)}>
        <span className="absolute left-3 top-2.5 z-10 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-900">미리보기 · 장식은 그대로 보여요</span>
        {/* 미리보기 안의 별·포닉스·장식은 누르거나 Tab으로 가지 않게 inert (WriteForm 미리보기와 같음, spec.md 3장) */}
        <div inert className="pointer-events-none mx-auto max-w-[260px] pt-6" aria-hidden>
          <TreeScene theme={theme} treeColor={color} ornaments={ornaments} season={season} lockedIcons />
        </div>
      </section>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-base font-bold">트리 색</legend>
        <div className="grid grid-cols-6 gap-2">
          {(Object.keys(TREE_COLORS) as TreeColorId[]).map((id) => (
            <button
              key={id} type="button" onClick={() => setColor(id)} aria-pressed={color === id}
              className="flex min-h-18 flex-col items-center gap-1.5 py-1"
            >
              <span
                className={`size-10 rounded-full ${color === id ? "ring-3 ring-white ring-offset-2 ring-offset-[#1c4566]" : "border border-white/40"}`}
                style={{ background: TREE_COLORS[id].tree[1] }}
              />
              <span className={`text-center text-[11px] leading-tight ${color === id ? "font-bold" : "opacity-85"}`}>{TREE_COLORS[id].name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-base font-bold">배경 테마</legend>
        <div className="grid grid-cols-2 gap-2">
          {USER_THEME_IDS.map((id) => (
            <button
              key={id} type="button" onClick={() => setTheme(id)} aria-pressed={theme === id}
              className={`flex min-h-24 flex-col gap-1.5 rounded-xl bg-white p-2 text-left ${theme === id ? "outline-3 outline-[#c8102e]" : ""}`}
            >
              <span className="h-13 rounded-lg" style={{ background: THEMES[id].bg }} />
              <span className="text-[13px] font-bold text-slate-900">{THEMES[id].name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <p className="rounded-lg bg-white/10 px-3 py-2.5 text-xs leading-5 opacity-85">
        친구들이 내 트리 링크로 들어오면 이 색과 테마로 보여요. 색 값은 디자인 확정 전 임시예요.
      </p>

      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Link href="/me" className="btn btn-ghost w-full">취소</Link>
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "저장하는 중…" : "저장하기"}</button>
      </div>
    </form>
  );
}
