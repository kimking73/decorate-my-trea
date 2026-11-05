"use client";
import { useEffect, useRef } from "react";

/** 눈 내리는 배경. density 는 D-day 가 가까울수록 커진다. */
export default function Snow({ density = 60 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    const flakes: { x: number; y: number; r: number; s: number; d: number }[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    const spawn = (n: number) => {
      for (let i = 0; i < n; i++)
        flakes.push({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.5, s: 0.4 + Math.random(), d: Math.random() * Math.PI * 2 });
    };
    resize();
    spawn(density);

    window.addEventListener("resize", resize);

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (const f of flakes) {
        f.d += 0.01;
        f.y += f.s;
        f.x += Math.sin(f.d) * 0.5;
        if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
}
