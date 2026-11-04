import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-6xl">🎄❓</p>
        <h1 className="font-display mt-4 text-2xl">트리를 찾을 수 없어요</h1>
        <p className="mt-2 text-sm opacity-80">링크가 정확한지 확인해주세요.</p>
        <Link href="/" className="btn btn-primary mt-6">홈으로</Link>
      </div>
    </main>
  );
}
