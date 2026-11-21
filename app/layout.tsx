import type { Metadata, Viewport } from "next";
import { Gowun_Dodum, Jua } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

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
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
