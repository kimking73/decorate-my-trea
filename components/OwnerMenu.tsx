import Link from "next/link";
import Toast from "@/components/Toast";
import { demoSignOut } from "@/app/actions";

// 서버 액션이 성공 후 /me?toast=… → 내 트리로 넘어오면 화면 아래 알림 (spec.md 5.1)
const TOASTS: Record<string, string> = {
  renamed: "트리 이름을 바꿨어요",
  styled: "트리 색·테마를 바꿨어요",
};

/** 내 트리(주인 화면) 아래 메뉴: 주소·색/이름 바꾸기·관리자·로그아웃 (spec.md 5.1, F10). TreeView의 ownerMenu로 넘긴다 */
export default function OwnerMenu({ shareUrl, isAdmin, demo, toast }: {
  shareUrl: string;
  isAdmin: boolean;
  demo: boolean;
  toast?: string;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="select-all break-all rounded-lg bg-white/10 px-3 py-2.5 text-sm opacity-90">{shareUrl}</p>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/me/style" className="flex min-h-12 items-center justify-center rounded-xl border border-white/40 text-sm font-bold">색·테마 바꾸기</Link>
        <Link href="/create" className="flex min-h-12 items-center justify-center rounded-xl border border-white/40 text-sm font-bold">이름 바꾸기</Link>
      </div>
      {isAdmin && (
        <Link href="/admin" className="flex min-h-13 items-center justify-between rounded-xl border border-dashed border-white/50 px-4 text-[15px]">
          <span>관리자 페이지</span><span aria-hidden>→</span>
        </Link>
      )}
      <div className="mt-2 flex justify-center border-t border-white/15 pt-3">
        <form {...(demo ? { action: demoSignOut } : { action: "/auth/signout", method: "post" })}>
          <button className="min-h-11 px-4 text-sm underline opacity-80">로그아웃</button>
        </form>
      </div>
      <Toast message={(toast && TOASTS[toast]) || null} clearQuery />
    </div>
  );
}
