"use client";
import { useEffect, useRef } from "react";

// 눈은 초당 30번만 그린다. 캔버스를 그릴 때마다 화면 전체를 다시 합성하고 다른 애니메이션의 스타일 계산도
// 같이 돌기 때문에, 60번 그리면 저사양 폰에서 평상시 CPU의 절반 이상을 눈이 쓴다 (C2 측정, plan.md).
const FPS = 30;
// 속도 값(s, d)은 60fps 한 프레임 기준이라 지난 시간만큼 곱해 준다. 탭 복귀 직후 한꺼번에 튀지 않게 상한을 둔다.
const BASE_MS = 1000 / 60;
const MAX_STEP = 4;

/** 눈 내리는 배경. density 는 D-day 가 가까울수록 커진다. */
export default function Snow({ density = 60 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0, h = 0, raf = 0, last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flakes: { x: number; y: number; r: number; s: number; d: number }[] = [];

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      // 눈송이를 한 경로에 모아 한 번만 칠한다.
      ctx.beginPath();
      for (const f of flakes) {
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
    };
    // 캔버스는 CSS 픽셀 크기 그대로 둔다 (devicePixelRatio 를 곱하지 않음 — 고해상도 폰에서 칠할 픽셀이 4~9배가 된다).
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      draw();
    };
    for (let i = 0; i < density; i++)
      flakes.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, r: 1 + Math.random() * 2.5, s: 0.4 + Math.random(), d: Math.random() * Math.PI * 2 });

    const tick = (now: number) => {
      const k = last ? Math.min((now - last) / BASE_MS, MAX_STEP) : 1;
      last = now;
      for (const f of flakes) {
        f.d += 0.01 * k;
        f.y += f.s * k;
        f.x += Math.sin(f.d) * 0.5 * k;
        if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
      }
      draw();
      schedule();
    };
    // setTimeout 뒤에 rAF: 쉬는 프레임에는 rAF 자체를 걸지 않아 메인 스레드가 깨어나지 않는다.
    const schedule = () => {
      timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, 1000 / FPS - BASE_MS / 2);
    };
    const stop = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      last = 0;
    };
    // 탭이 가려졌거나 "동작 줄이기"가 켜져 있으면 멈춘다 (동작 줄이기: 눈은 멈춘 채로 보인다).
    const sync = () => {
      stop();
      if (!document.hidden && !reduce.matches) schedule();
    };

    resize();
    sync();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);
    reduce.addEventListener?.("change", sync);
    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      reduce.removeEventListener?.("change", sync);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
}
