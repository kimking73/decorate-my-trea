import Link from "next/link";
import { redirect } from "next/navigation";
import AdminCreateForm from "@/components/AdminCreateForm";
import AdminEditForm from "@/components/AdminEditForm";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import ReadLinkBox from "@/components/ReadLinkBox";
import Toast from "@/components/Toast";
import { adminIssueReadLink, adminResolve, adminSetTreeOpen } from "@/app/actions";
import { DEPARTMENTS, SITE_URL } from "@/lib/constants";
import { getAdminSpecialTrees, getProfile, getReportedLetters, getUser, loginPath } from "@/lib/data";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "make", label: "교수님 트리 만들기" },
  { id: "list", label: "교수님 목록" },
  { id: "reports", label: "신고" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const FILTERS = [
  { id: "all", label: "전체" },
  { id: "wait", label: "허락 대기" },
  { id: "open", label: "트리 열림" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

// 액션이 /admin?toast=… 로 보내면 화면 아래 알림 (spec.md 5.1)
const TOASTS: Record<string, string> = {
  created: "교수님 트리를 허락 대기로 만들었어요",
  updated: "교수님 트리 정보를 고쳤어요",
  opened: "트리를 열었어요",
  closed: "트리를 닫았어요",
  link_issued: "열람 링크를 만들었어요. 복사해서 교수님께 보내 주세요",
  restored: "편지를 되살렸어요",
  deleted: "편지를 지웠어요",
  failed: "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
  demo: "데모라 저장되지 않아요",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string; toast?: string }> }) {
  const user = await getUser();
  if (!user) redirect(loginPath("/admin"));
  const profile = await getProfile();

  if (!profile?.is_admin) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-5xl" aria-hidden>🔒</p>
          <h1 className="font-display mt-4 text-2xl">관리자만 볼 수 있어요</h1>
          <Link href="/me" className="btn btn-primary mt-6">내 트리로</Link>
        </div>
      </main>
    );
  }

  const { tab: rawTab, filter: rawFilter, toast } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "make";
  const filter: FilterId = FILTERS.some((f) => f.id === rawFilter) ? (rawFilter as FilterId) : "all";

  // 신고 건수는 탭 이름에 보여 늘 조회한다
  const [reports, trees] = await Promise.all([
    getReportedLetters(),
    tab === "list" ? getAdminSpecialTrees() : Promise.resolve([]),
  ]);
  const professors = trees
    .filter((t) => t.kind === "professor" && (filter === "all" || (filter === "open") === t.is_open))
    .sort((a, b) => b.like_count - a.like_count);

  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <header className="flex h-14 items-center justify-between px-2">
        <Link href="/me" className="flex min-h-11 items-center px-2 text-sm opacity-85">← 내 트리</Link>
        <span className="pr-2 text-[15px] font-bold">관리자</span>
      </header>

      <nav aria-label="관리자 메뉴" className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-white/20 px-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`flex min-h-13 items-center justify-center border-b-[3px] text-sm ${t.id === tab ? "border-white font-bold" : "border-transparent opacity-70"}`}
          >
            {t.id === "reports" ? `${t.label} ${reports.length}` : t.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-5">
        {tab === "make" && (
          <section aria-label="교수님 트리 만들기">
            <p className="mb-3 text-sm opacity-80">홈의 &lsquo;교수님께 마음 전하기&rsquo;에 보일 트리를 만들어요.</p>
            <div className="card p-4"><AdminCreateForm /></div>
          </section>
        )}

        {tab === "list" && (
          <section aria-label="교수님 목록" className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl">교수님 목록</h2>
              <span className="text-xs opacity-75">관심 많은 순</span>
            </div>
            <nav aria-label="상태로 거르기" className="flex gap-2">
              {FILTERS.map((f) => (
                <Link
                  key={f.id} href={`/admin?tab=list&filter=${f.id}`} aria-current={f.id === filter ? "page" : undefined}
                  className={`flex min-h-10 items-center rounded-full px-3.5 text-sm ${f.id === filter ? "bg-white font-bold text-slate-900" : "border border-white/40"}`}
                >
                  {f.label}
                </Link>
              ))}
            </nav>
            {professors.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/40 p-4 text-center text-sm opacity-80">
                {filter === "all" ? "아직 교수님 트리가 없어요" : "해당하는 교수님이 없어요"}
              </p>
            )}
            {professors.map((t) => (
              <div key={t.id} className="card flex flex-col gap-3 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{t.owner_name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[DEPARTMENTS.find((d) => d.id === t.department)?.name, `편지 ${t.is_open ? `${t.letter_count}통` : "-"}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold" aria-label={`관심 ${t.like_count}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
                    {t.like_count}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${t.is_open ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {t.is_open ? "트리 열림" : "허락 대기"}
                  </span>
                </div>
                <div className="grid gap-2">
                  {t.is_open ? (
                    <Link href={`/t/${t.slug}`} className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 text-sm font-bold">트리 보기</Link>
                  ) : (
                    <form action={adminSetTreeOpen}>
                      <input type="hidden" name="tree_id" value={t.id} />
                      <input type="hidden" name="open" value="1" />
                      <input type="hidden" name="filter" value={filter} />
                      <ConfirmSubmitButton
                        confirm={`${t.owner_name}께 허락을 받았나요? 트리를 열면 누구나 편지를 쓸 수 있어요.`}
                        pendingLabel="여는 중…" className="btn btn-primary w-full whitespace-nowrap !px-2 !py-2 text-[13px]"
                      >
                        허락 받음 · 트리 열기
                      </ConfirmSubmitButton>
                    </form>
                  )}
                  {/* 정보 수정: 0007 admin_update_special_tree (spec.md 3장) — 주소는 바꿀 수 없다 */}
                  <details>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-300 text-sm font-bold [&::-webkit-details-marker]:hidden">
                      정보 수정
                    </summary>
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
                      <AdminEditForm tree={t} filter={filter} />
                    </div>
                  </details>
                </div>
                {/* 교수님 비밀 열람 링크 (spec.md 4.6, T9): 로그인 없이 12/25 0시부터 편지를 읽는 링크 */}
                <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
                  <p className="text-xs font-bold text-slate-600">교수님 열람 링크</p>
                  {t.read_key ? (
                    <>
                      <ReadLinkBox url={`${SITE_URL}/t/${t.slug}?key=${t.read_key}`} name={t.owner_name} />
                      <form action={adminIssueReadLink}>
                        <input type="hidden" name="tree_id" value={t.id} />
                        <ConfirmSubmitButton
                          confirm={`${t.owner_name} 열람 링크를 다시 만들까요? 이전 링크는 더 이상 쓸 수 없어요.`}
                          pendingLabel="만드는 중…" className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 text-sm font-bold"
                        >
                          링크 다시 만들기
                        </ConfirmSubmitButton>
                      </form>
                      <p className="text-xs leading-5 text-slate-500">링크를 가진 사람은 로그인 없이 12월 25일 0시부터 편지를 읽을 수 있어요. 교수님께만 보내 주세요. 다시 만들면 이전 링크는 못 써요.</p>
                    </>
                  ) : (
                    <>
                      <form action={adminIssueReadLink}>
                        <input type="hidden" name="tree_id" value={t.id} />
                        <ConfirmSubmitButton
                          confirm={`${t.owner_name} 열람 링크를 만들까요? 링크를 가진 사람은 크리스마스에 편지를 읽을 수 있어요.`}
                          pendingLabel="만드는 중…" className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 text-sm font-bold"
                        >
                          열람 링크 만들기
                        </ConfirmSubmitButton>
                      </form>
                      <p className="text-xs leading-5 text-slate-500">교수님은 이 링크로 로그인 없이 12월 25일 0시부터 편지를 읽어요.</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === "reports" && (
          <section aria-label="신고" className="flex flex-col gap-2.5">
            <h2 className="font-display text-xl">신고된 편지 <span className="text-base opacity-70">{reports.length}건</span></h2>
            {reports.length === 0 && <p className="rounded-xl border border-dashed border-white/40 p-4 text-center text-sm opacity-80">신고된 편지가 없어요</p>}
            {reports.map((l) => (
              <div key={l.id} className="card flex flex-col gap-2.5 p-4">
                <div className="flex justify-between gap-2 text-xs text-slate-500">
                  <span className="truncate">{l.tree_title ?? "(알 수 없는 트리)"}</span>
                  <span className="shrink-0">{new Date(l.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
                </div>
                <p className="whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2.5 text-sm leading-6">{l.content}</p>
                <div className="grid grid-cols-2 gap-2">
                  <form action={adminResolve}>
                    <input type="hidden" name="letter_id" value={l.id} />
                    <input type="hidden" name="restore" value="1" />
                    <button className="btn btn-light w-full !py-2 text-sm">복구</button>
                  </form>
                  <form action={adminResolve}>
                    <input type="hidden" name="letter_id" value={l.id} />
                    <input type="hidden" name="restore" value="0" />
                    <ConfirmSubmitButton confirm="이 편지를 삭제할까요? 되돌릴 수 없어요." pendingLabel="삭제하는 중…" className="btn btn-primary w-full !py-2 text-sm">삭제…</ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
      <Toast message={(toast && TOASTS[toast]) || null} clearQuery />
    </main>
  );
}
