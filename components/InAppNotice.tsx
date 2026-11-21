"use client";
import { useEffect, useState } from "react";
import Toast from "@/components/Toast";

// 인스타·카톡 등 앱 안 브라우저에서는 Google 로그인이 막힐 수 있어 카카오나 외부 브라우저를 권한다 (spec.md 3장)
const IN_APP = /Instagram|KAKAOTALK|FBAN|FBAV|FB_IAB|Line\/|NAVER|DaumApps|everytimeApp/i;

export default function InAppNotice() {
  const [inApp, setInApp] = useState(false);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);

  useEffect(() => {
    setInApp(IN_APP.test(navigator.userAgent));
  }, []);

  if (!inApp) return null;

  async function copy() {
    let text = "링크를 복사했어요. Safari·Chrome에 붙여 넣어 주세요";
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      text = "복사하지 못했어요. 주소창을 길게 눌러 복사해 주세요";
    }
    setToast((t) => ({ text, n: (t?.n ?? 0) + 1 }));
  }

  return (
    <section className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-dashed border-white/60 p-4 text-left">
      <p className="text-sm leading-6">
        <b>Google 로그인은 앱 안 브라우저에서 막힐 수 있어요.</b>
        <br />카카오로 시작하거나, 링크를 복사해 Safari·Chrome에서 열어 주세요.
      </p>
      <button type="button" className="btn btn-ghost w-full !py-2.5 text-base" onClick={copy}>이 페이지 링크 복사</button>
      <Toast key={toast?.n ?? 0} message={toast?.text ?? null} />
    </section>
  );
}
