import type { Metadata, Viewport } from "next";
import { Gowun_Dodum, Jua } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { WebAnalytics } from "@/components/WebAnalytics";

// 방문 수집은 환경변수가 있는 배포에서만 붙인다. 환경변수 없이 도는 QA 데모
// (spec.md 1.1 데모 배포)에서는 스크립트를 부르지 않는다. Preview 배포도 같이
// 수집되며(라이브러리가 NODE_ENV로 판단), 대시보드에서 환경별로 나춰 본다.
const analyticsOn = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} 🎄 크리스마스 트리를 꾸며주세요`,
  description: "POSTECH 친구의 트리에 익명 편지를 달아주세요. 편지는 크리스마스에 열려요!",
  openGraph: {
    title: `${SITE_NAME} 🎄`,
    description: "내 트리를 만들고 친구들에게 익명 편지를 받아보세요. 12월 25일에 열려요!",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f2a44",
};

// 빌드할 때 내려받아 우리 도메인에서 서빙한다 (자체 호스팅, 인앱 브라우저에서 외부 요청 없음).
// 한글 글리프는 unicode-range로 나뉜 파일이 필요할 때만 받아지므로 preload는 끈다.
const gowunDodum = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-gowun-dodum",
});

const jua = Jua({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-jua",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${gowunDodum.variable} ${jua.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        {analyticsOn && <WebAnalytics />}
      </body>
    </html>
  );
}
