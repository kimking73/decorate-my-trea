import Link from "next/link";

// 트리가 아닌 없는 페이지 (없는 트리는 app/t/[slug]/not-found.tsx)
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-6xl" aria-hidden>🎄❓</p>
        <h1 className="font-display mt-4 text-2xl">페이지를 찾을 수 없어요</h1>
        <Link href="/" className="btn btn-primary mt-6">홈으로</Link>
      </div>
    </main>
  );
}
