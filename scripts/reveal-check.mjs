#!/usr/bin/env node
// C12 공개 순간 새로 고침 확인 (spec.md 4.5). 데모 모드 개발 서버를 직접 띄운다 (Supabase 환경변수는 지운다).
// NEXT_PUBLIC_REVEAL_AT을 몇십 초 뒤로 두고 주인·방문자 탭을 여러 개 열어, 0시가 지난 뒤 각 탭이 언제 요청하는지와
// 결국 열리는지를 기록한다. 실서버 동작과 무관한 검증용 스크립트다.
//
// 사용법: node scripts/reveal-check.mjs [--mode ok|http500|abort|throw] [--fail N] [--delay ms] [--lead ms] [--port 3100] [--prod] [--out result.json]
//   --prod   개발 서버 대신 공개 시각을 넣어 next build 후 next start (빌드 시간 때문에 --lead 기본 180초)
//   ok       서버 정상
//   http500  탭마다 공개 후 처음 N번 요청을 500(text/plain)으로 바꾼다 (브라우저 쪽에서 가로챔, 앱 코드 변경 없음)
//   abort    탭마다 공개 후 처음 N번 요청을 네트워크 오류로 끊는다
//   throw    DEMO_REVEAL_FAILURES=N으로 서버를 띄워 공개 후 트리 페이지 처음 N번이 throw (lib/data.ts 데모 분기)
//   --delay  공개 후 새로 고침 응답을 ms만큼 늦춘다 (한 탭의 요청이 겹치지 않는지 확인)
// 개발 서버가 .next를 쓰므로 npm run build·npm start와 동시에 돌리지 않는다 (결과가 깨진다).
// `/t/demo?dday=7` 탭은 서버가 계속 공개 전 화면을 주는 경우라, 재시도를 다 쓰고 "다시 시도" 버튼이 나와야 한다.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(require.resolve("playwright", { paths: [process.env.NODE_PATH ?? "", "/usr/lib/node_modules", "/usr/local/lib/node_modules"] }))); }

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const MODE = arg("mode", "ok");
const FAIL = Number(arg("fail", MODE === "throw" ? 6 : 1));
const DELAY = Number(arg("delay", 0));
const PROD = process.argv.includes("--prod");
const LEAD = Number(arg("lead", PROD ? 180_000 : 45_000));
const PORT = Number(arg("port", 3100));
const OUT = arg("out", "");
const BASE = `http://localhost:${PORT}`;
const OWNER_MAX = 30_000, VISITOR_MAX = 120_000;

const TABS = [
  { name: "owner-1", path: "/t/demo?owner=1", owner: true },
  { name: "owner-2", path: "/t/demo?owner=1", owner: true },
  { name: "owner-3", path: "/t/prof-demo?owner=1", owner: true },
  { name: "reader", path: "/t/prof-demo?key=demo", owner: true }, // 교수님 비밀 열람 링크(T9): 주인처럼 0~30초
  { name: "visitor-1", path: "/t/demo", owner: false },
  { name: "visitor-2", path: "/t/demo", owner: false },
  { name: "visitor-3", path: "/t/prof-demo", owner: false },
  { name: "visitor-4", path: "/t/demo?owner=0", owner: false },
  { name: "dday7", path: "/t/demo?dday=7", owner: false, expect: "failed" },
];

// ---------- 서버 ----------
const revealAt = new Date(Date.now() + LEAD);
const env = { ...process.env, NEXT_PUBLIC_REVEAL_AT: revealAt.toISOString(), NEXT_TELEMETRY_DISABLED: "1" };
delete env.NEXT_PUBLIC_SUPABASE_URL;
delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete env.SUPABASE_SERVICE_ROLE_KEY;
if (MODE === "throw") env.DEMO_REVEAL_FAILURES = String(FAIL);
else delete env.DEMO_REVEAL_FAILURES;
if (PROD) {
  // NEXT_PUBLIC_REVEAL_AT은 빌드 때 코드에 박히므로 빌드부터 다시 한다
  const build = spawn("npx", ["next", "build"], { env, stdio: "inherit" });
  const code = await new Promise((r) => build.on("exit", r));
  if (code !== 0) throw new Error("next build 실패");
}
const server = spawn("npx", ["next", PROD ? "start" : "dev", "-p", String(PORT)], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });
const stopServer = () => { try { process.kill(-server.pid, "SIGTERM"); } catch {} };
process.on("exit", stopServer);
process.on("SIGINT", () => process.exit(130));

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE + "/")).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("서버가 뜨지 않았어요\n" + serverLog.slice(-2000));
}
await waitForServer();
for (const t of TABS) await fetch(BASE + t.path).catch(() => {}); // 개발 서버 첫 컴파일을 미리
if (Date.now() > revealAt.getTime() - 10_000) throw new Error("--lead가 너무 짧아요 (서버 준비 뒤 10초 이상 남아야 함)");

// ---------- 탭 ----------
const t0 = revealAt.getTime();
const rel = (ms = Date.now()) => (ms - t0) / 1000;
const log = [];
const browser = await chromium.launch();

async function runTab(tab) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  const requests = []; // 공개 후 이 탭이 보낸 새로 고침 요청 (rsc: router.refresh, document: 브라우저 새로 고침)
  let injected = 0, loaded = false;
  const ev = (e) => log.push({ t: rel(), tab: tab.name, e });

  await page.route("**/*", async (route) => {
    const req = route.request();
    const h = req.headers();
    const kind = h.rsc === "1" && !h["next-router-prefetch"] ? "rsc" : req.resourceType() === "document" && loaded ? "document" : null;
    if (!kind || Date.now() < t0) return route.continue();
    const r = { t: rel(), kind, result: "pass" };
    requests.push(r);
    if ((MODE === "http500" || MODE === "abort") && injected < FAIL) {
      injected++;
      r.result = MODE;
      ev(`${kind} 요청 → ${MODE} 흉내 (${injected}/${FAIL})`);
      if (MODE === "abort") return route.abort("failed");
      return route.fulfill({ status: 500, contentType: "text/plain", body: "injected 500" });
    }
    ev(`${kind} 요청`);
    if (DELAY) await new Promise((res) => setTimeout(res, DELAY));
    return route.continue().catch(() => {});
  });

  await page.goto(BASE + tab.path, { waitUntil: "networkidle" });
  loaded = true;
  let last = "", final = "timeout", retried = false;
  const deadline = t0 + VISITOR_MAX + 90_000;
  while (Date.now() < deadline) {
    const ui = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes("injected 500")) return "raw-500";
      if (text.includes("잠시 문제가 생겼어요")) return "error-page";
      const status = document.querySelector('[role="status"]')?.textContent ?? "";
      const chip = document.querySelector("nav span.rounded-full")?.textContent ?? "";
      if (chip.includes("편지 오픈")) return "opened";
      if (status.includes("붐벼요")) return "failed";
      if (status.includes("꺼내는 중")) return "opening";
      return `chip:${chip}`;
    }).catch(() => "navigating");
    if (ui !== last) { ev(`화면: ${ui}`); last = ui; }
    if (ui === "opened") { final = "opened"; break; }
    if (ui === "raw-500") { final = "raw-500"; break; }
    if (ui === "failed" && !retried) {
      // "다시 시도" 버튼이 요청을 한 번 더 보내는지 확인
      retried = true;
      const before = requests.length;
      await page.getByRole("button", { name: "다시 시도" }).click();
      await page.waitForTimeout(3000);
      ev(`"다시 시도" 누름 → 요청 ${requests.length - before}개`);
      final = requests.length > before ? "failed+retry-ok" : "failed+retry-none";
      break;
    }
    await page.waitForTimeout(200);
  }
  await ctx.close();
  return { ...tab, final, requests };
}

const results = await Promise.all(TABS.map(runTab));
await browser.close();
stopServer();

// ---------- 결과 ----------
log.sort((a, b) => a.t - b.t);
for (const l of log) console.log(`${l.t.toFixed(1).padStart(7)}s  ${l.tab.padEnd(10)} ${l.e}`);
console.log(`\n모드 ${MODE}${MODE !== "ok" ? ` (실패 ${FAIL}번)` : ""}${DELAY ? `, 응답 지연 ${DELAY}ms` : ""} · 공개 시각 ${revealAt.toISOString()}`);
console.log("탭         첫 요청   요청 수  최소 간격  결과");
const problems = [];
for (const r of results) {
  const first = r.requests[0]?.t;
  const gaps = r.requests.slice(1).map((q, i) => q.t - r.requests[i].t).filter((g) => g > 0);
  const minGap = gaps.length ? Math.min(...gaps) : null;
  console.log(`${r.name.padEnd(10)} ${first == null ? "   -   " : `${first.toFixed(1).padStart(6)}s`}  ${String(r.requests.length).padStart(5)}    ${minGap == null ? "   -  " : `${minGap.toFixed(1).padStart(5)}s`}   ${r.final}`);
  const expect = r.expect ?? "opened";
  if (!r.final.startsWith(expect)) problems.push(`${r.name}: ${r.final} (기대 ${expect})`);
  if (r.final === "failed+retry-none") problems.push(`${r.name}: "다시 시도"가 요청을 보내지 않음`);
  const limit = (r.owner ? OWNER_MAX : VISITOR_MAX) / 1000 + 2;
  if (first == null) problems.push(`${r.name}: 요청 없음`);
  else if (first > limit) problems.push(`${r.name}: 첫 요청 ${first.toFixed(1)}s > ${limit}s`);
}
const firsts = results.map((r) => r.requests[0]?.t).filter((t) => t != null).sort((a, b) => a - b);
const sameMoment = firsts.slice(1).filter((t, i) => t - firsts[i] < 0.1).length;
console.log(`첫 요청 분포: ${firsts.map((t) => t.toFixed(1)).join(", ")}${sameMoment ? ` (0.1초 안에 겹친 탭 ${sameMoment}쌍)` : ""}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ mode: MODE, fail: FAIL, delay: DELAY, revealAt, results, log }, null, 1));
console.log(problems.length ? `\n문제:\n- ${problems.join("\n- ")}` : "\n모든 탭이 기대대로 동작했어요");
process.exit(problems.length ? 1 : 0);
