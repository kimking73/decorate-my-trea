"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleProfessorLike } from "@/app/actions";
import Toast from "@/components/Toast";
import { DEPARTMENTS } from "@/lib/constants";
import type { ProfessorRow } from "@/lib/data";

const deptName = (id: string | null) => DEPARTMENTS.find((d) => d.id === id)?.name ?? "";

// /professors 목록: 관심순·검색·하트 (spec.md 3장, 4.6). 검색은 받은 목록을 화면에서 거른다
export default function ProfessorList({ professors, isLoggedIn }: { professors: ProfessorRow[]; isLoggedIn: boolean }) {
  const [rows, setRows] = useState(professors);
  // 화면은 로그인 상태로 열렸지만 그사이 세션이 끝난 경우, 서버 응답을 보고 로그인 안내로 바꾼다.
  // 다른 탭에서 다시 로그인했을 수 있으므로 이후 클릭도 서버에 보내고, 성공하면 되돌린다
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);
  const [query, setQuery] = useState("");
  const [promptFor, setPromptFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; seq: number } | null>(null);
  const [, startTransition] = useTransition();

  const q = query.trim();
  const searching = q.length > 0;
  const sorted = [...rows].sort((a, b) => b.like_count - a.like_count || a.owner_name.localeCompare(b.owner_name, "ko"));
  const shown = searching ? sorted.filter((p) => p.owner_name.includes(q) || deptName(p.department).includes(q)) : sorted;

  function onHeart(p: ProfessorRow) {
    // 처음부터 로그인하지 않은 화면은 서버에 묻지 않고 안내만 연다
    if (!isLoggedIn) {
      setPromptFor(promptFor === p.id ? null : p.id);
      return;
    }
    setBusy(p.id);
    startTransition(async () => {
      const r = await toggleProfessorLike(p.id);
      setBusy(null);
      if ("error" in r && r.code === "login_required") {
        setLoggedIn(false);
        setPromptFor(p.id);
        return;
      }
      if ("error" in r) {
        // 같은 오류가 연달아 나도 다시 보이게 seq를 올린다 (Toast가 seq 변화로 새 알림을 띄움)
        setToast((t) => ({ text: r.error, seq: (t?.seq ?? 0) + 1 }));
        return;
      }
      setLoggedIn(true);
      setPromptFor(null);
      setRows((all) => all.map((x) => (x.id === p.id ? { ...x, liked_by_me: r.liked, like_count: r.count } : x)));
    });
  }

  return (
    <>
      <div className="mt-5 flex flex-col gap-1.5">
        <label htmlFor="prof-q" className="text-sm font-bold">교수님 이름 검색</label>
        <div className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-3 text-slate-900">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5c5c5c" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            id="prof-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 김OO, 컴퓨터공학과" className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </div>
      </div>

      <h2 className="font-display mt-6 text-xl">{searching ? "검색 결과" : "관심 많은 교수님"}</h2>
      {shown.length === 0 && (
        <p className="mt-3 rounded-xl border border-dashed border-white/40 p-4 text-center text-sm leading-6 opacity-85">
          {searching ? <>찾는 교수님이 목록에 없어요.<br />이름을 다시 확인해 주세요.</> : "아직 등록된 교수님이 없어요"}
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-2.5">
        {shown.map((p, i) => {
          // 로그인이 끝난 동안에는 예전에 누른 하트를 채워 보이지 않는다 (눌러도 취소되지 않으므로)
          const liked = loggedIn && p.liked_by_me;
          return (
          <li key={p.id} className="card flex flex-col gap-3 p-4 text-slate-900">
            <div className="flex items-center gap-3">
              {!searching && <span className="font-display w-6 shrink-0 text-center text-lg text-slate-500">{i + 1}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.owner_name}</p>
                <p className="truncate text-xs text-slate-500">
                  {[deptName(p.department), p.is_open ? "트리 열림" : "허락 대기"].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                type="button" onClick={() => onHeart(p)} disabled={busy === p.id} aria-pressed={liked}
                aria-label={`${liked ? "관심 취소" : "관심 보내기"}${loggedIn ? "" : " (로그인 필요)"}, 현재 ${p.like_count}`}
                className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full border px-3 text-sm font-bold ${liked ? "border-[#c8102e] bg-red-50 text-[#c8102e]" : "border-slate-300 bg-white"}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
                <span className="tabular-nums">{p.like_count.toLocaleString()}</span>
              </button>
            </div>

            {/* 라이브 영역은 늘 두고 안의 내용만 바꾼다 (새로 붙은 영역은 스크린리더가 읽지 않는 경우가 많음) */}
            <div role="status" className="empty:hidden">
              {!loggedIn && promptFor === p.id && (
                <div className="flex flex-col gap-2 rounded-xl bg-slate-100 p-3 text-sm leading-6">
                  <p><b>하트는 로그인한 사람만 누를 수 있어요.</b><br />로그인하면 이 화면으로 돌아와요.</p>
                  <Link href="/login?next=/professors" className="btn btn-primary w-full !py-2 text-sm">로그인하고 하트 보내기</Link>
                </div>
              )}
            </div>
            {p.is_open && p.slug && (
              <Link href={`/t/${p.slug}/write`} className="btn btn-primary w-full !py-2.5 text-sm">
                트리 꾸미러 가기
              </Link>
            )}
            <div role="status" className="empty:hidden">
              {searching && !p.is_open && (
                <p className="rounded-lg bg-slate-100 px-3 py-2.5 text-sm leading-6 text-slate-700">아직 교수님의 허락을 받지 못했어요. 하지만 관심 버튼을 눌러주시면 도움이 돼요!</p>
              )}
            </div>
          </li>
          );
        })}
      </ul>
      <Toast message={toast?.text ?? null} seq={toast?.seq} />
    </>
  );
}
