// 페이지를 불러오는 동안 보이는 뼈대 (spec.md 5.1 공통 상태).
// 로그인이 필요한 화면의 loading.tsx에서만 쓴다. 링크로 공유되는 /, /t/** 에 두면 응답이 스트리밍되어
// 카카오톡 미리보기 봇이 og 태그를 못 읽고, 없는 트리도 404 대신 200이 된다.
export default function LoadingSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 px-4 pt-20">
      <span className="sr-only" role="status">불러오는 중</span>
      <div className="h-8 w-2/3 animate-pulse self-center rounded-lg bg-white/15" />
      <div className="h-64 animate-pulse rounded-2xl bg-white/10" />
      <div className="h-13 animate-pulse rounded-full bg-white/15" />
      <div className="h-13 animate-pulse rounded-full bg-white/10" />
    </main>
  );
}
