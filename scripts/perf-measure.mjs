#!/usr/bin/env node
// C2 성능 측정: 헤드리스 Chromium, 모바일 폭(375px), CPU 스로틀. 데모 모드 서버(`npm run build && npm start`)가 떠 있어야 한다.
// 사용법: node scripts/perf-measure.mjs [--base http://localhost:3000] [--cpu 4] [--secs 6] [--out result.json] [--reduced]
// 헤드리스는 GPU 없이 소프트웨어 래스터라 절대값은 실기기와 다르다. 같은 환경에서 전/후 비교용으로만 쓴다.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(require.resolve("playwright", { paths: [process.env.NODE_PATH ?? "", "/usr/lib/node_modules", "/usr/local/lib/node_modules"] }))); }

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg("base", "http://localhost:3000");
const CPU = Number(arg("cpu", 4));
const SECS = Number(arg("secs", 6));
const OUT = arg("out", "");
const REDUCED = process.argv.includes("--reduced");
const CSS = arg("css", ""); // 원인 분리용: 측정 전에 넣을 CSS (예: "canvas{display:none}")
const PAGES = arg("pages", "").split(",").filter(Boolean).length ? arg("pages", "").split(",") : ["/t/demo", "/t/demo?dday=0", "/t/demo?fill=60", "/t/demo/write", "/"];

// 메인 스레드: 스타일·레이아웃·페인트 / 래스터 스레드: 픽셀 그리기(필터·그림자 비용이 여기 잡힌다)
const MAIN = { style: ["UpdateLayoutTree", "RecalculateStyles"], layout: ["Layout"], paint: ["Paint", "PrePaint", "Layerize", "UpdateLayer", "Commit"], script: ["FunctionCall", "FireAnimationFrame", "EvaluateScript", "TimerFire"] };
const RASTER = ["RasterTask", "ImageDecodeTask"];

const browser = await chromium.launch();
const rows = [];
for (const path of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: REDUCED ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (CSS) await page.addStyleTag({ content: CSS });
  await page.waitForTimeout(1500); // 진입 애니메이션(pop-in, 폭죽)이 끝난 뒤의 평상시 상태를 잰다
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await page.waitForTimeout(500);

  const events = [];
  cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
  const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,cc,benchmark", transferMode: "ReportEvents" });

  // 1) 수동 구간: 페이지에 아무것도 넣지 않고 트레이스만 받는다 (rAF 프로브를 돌리면 매 프레임 메인 스레드가 깨어나 비용이 부풀려진다).
  await page.waitForTimeout(SECS * 1000);
  await cdp.send("Tracing.end");
  await done;
  // 2) 프로브 구간: rAF 간격으로 끊김(프레임 간격)과 긴 작업을 잰다.
  const inPage = await page.evaluate((secs) => new Promise((resolve) => {
    const gaps = []; const longs = [];
    let po;
    try { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) longs.push(e.duration); }); po.observe({ entryTypes: ["longtask"] }); } catch {}
    let last = performance.now(); const t0 = last;
    const step = (t) => {
      gaps.push(t - last); last = t;
      if (t - t0 < secs * 1000) requestAnimationFrame(step);
      else { po?.disconnect(); resolve({ gaps, longs, ms: t - t0 }); }
    };
    requestAnimationFrame(step);
  }), Math.min(SECS, 3));
  await cdp.send("Performance.enable"); const pm = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));

  const sum = (names) => events.filter((e) => e.ph === "X" && names.includes(e.name)).reduce((a, e) => a + (e.dur ?? 0), 0) / 1000;
  const per = (ms) => +(ms / SECS).toFixed(1); // 1초당 ms
  const bmf = events.filter((e) => e.ph === "X" && e.name === "ProxyMain::BeginMainFrame");
  const mainTid = bmf[0]?.tid;
  const mainBusy = per(events.filter((e) => e.ph === "X" && e.name === "RunTask" && e.tid === mainTid).reduce((a, e) => a + e.dur, 0) / 1000);
  const gaps = inPage.gaps.slice(1).sort((a, b) => a - b);
  const q = (p) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))];
  if (process.argv.includes("--detail")) {
    const by = {};
    for (const e of events) if (e.ph === "X" && e.dur) by[e.name] = (by[e.name] ?? 0) + e.dur / 1000;
    console.log(path, Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${per(v)}`).join(" "));
  }
  const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
  const canvas = await page.evaluate(() => { const c = document.querySelector("canvas"); return c ? `${c.width}x${c.height}` : "-"; });
  rows.push({
    page: path,
    main_busy: mainBusy, // 메인 스레드가 1초에 일한 시간(ms). 1000에 가까울수록 프레임을 놓친다
    main_frames: +(bmf.length / SECS).toFixed(1), // 1초에 메인 스레드가 만든 프레임 수 (적을수록 쉰다)
    probe_fps: +(gaps.length / (inPage.ms / 1000)).toFixed(1),
    frame_p95: +q(0.95).toFixed(1), frame_max: +gaps[gaps.length - 1].toFixed(1),
    jank_pct: +((gaps.filter((g) => g > 33.4).length / gaps.length) * 100).toFixed(1), // 2프레임 넘게 걸린 프레임 비율
    longtasks: inPage.longs.length, longtask_ms: Math.round(inPage.longs.reduce((a, b) => a + b, 0)),
    script: per(sum(MAIN.script)), style: per(sum(MAIN.style)), layout: per(sum(MAIN.layout)), paint: per(sum(MAIN.paint)), raster: per(sum(RASTER)),
    heap_mb: +(pm.JSHeapUsedSize / 1048576).toFixed(1), nodes: pm.Nodes, running_anims: anims, canvas,
  });
  await ctx.close();
}
await browser.close();

console.log(`CPU ${CPU}x 스로틀 · 375x667 @2x · ${SECS}s${REDUCED ? " · reduced-motion" : ""}  (main_busy, script~raster: 1초당 ms)`);
console.table(rows);
if (OUT) writeFileSync(OUT, JSON.stringify({ cpu: CPU, secs: SECS, reduced: REDUCED, rows }, null, 2));
