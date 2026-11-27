"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * 페이지 방문 수집 (S15, spec.md 1.1 관측·4.5).
 * - 쿠키를 쓰지 않는다. 방문 경로만 센다.
 * - 주소에 붙은 검색어는 보내지 않는다. 교수님 열람 링크의 `?key=…` 가 수집되면 안 된다
 *   (spec.md 4.6·5.1). Next 통합은 경로(`/t/<slug>`)만 보내지만, 라이브러리가 바뀌어도
 *   키가 새지 않도록 이벤트 주소에서 검색어·해시를 한 번 더 지운다.
 */
const stripQuery = ({ type, url }: { type: "pageview" | "event"; url: string }) => {
  const clean = url.split("?")[0].split("#")[0];
  return clean === url ? { type, url } : { type, url: clean };
};

export function WebAnalytics() {
  return <Analytics beforeSend={stripQuery} />;
}
