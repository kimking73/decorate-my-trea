// 접근성 점검 (C9, spec.md 4.2 "접근성"). 데모 서버(`npm run dev` 또는 `npm start`, Supabase 환경변수 없음)를 띄운 상태에서:
//   node scripts/a11y-check.mjs --axe <axe.min.js 경로> [--base http://localhost:3000] [--out <스크린샷 폴더>] [--ignore meta-viewport,...]
// axe-core 는 저장소 의존성이 아니다. 예: (빈 폴더에서) npm i axe-core → node_modules/axe-core/axe.min.js
// 하는 일: ① 데모 화면 axe 점검(critical·serious 만 실패로 셈) ② 키보드만으로 트리·편지 쓰기·편지 창 흐름
//          ③ prefers-reduced-motion 에서 계속 도는 애니메이션·썰매가 없는지. 실패가 있으면 종료 코드 1.
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const AXE_PATH = arg("axe");
const BASE = arg("base", "http://localhost:3000");
const OUT = arg("out");
if (!AXE_PATH) {
  console.error("사용: node scripts/a11y-check.mjs --axe <axe.min.js 경로> [--base URL] [--out 폴더]");
  process.exit(2);
}
const AXE = readFileSync(AXE_PATH, "utf8");
if (OUT) mkdirSync(OUT, { recursive: true });
// 다른 담당 파일에서 나는 axe 규칙: 목록에는 보여 주되 실패로 세지 않는다 (보고 대상)
const IGNORE = new Set((arg("ignore", "meta-viewport") || "").split(",").filter(Boolean));
const OWNER_NOTE = { "meta-viewport": "app/layout.tsx viewport maximumScale — 프론트엔드" };

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? "✅" : "❌"} ${msg}`);
  if (!ok) failures.push(msg);
};

const browser = await chromium.launch();
const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: OUT ? 2 : 1, ...opts });
  return ctx.newPage();
};
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: join(OUT, `${name}.png`) }); };
const active = (page) => page.evaluate(() => {
  const el = document.activeElement;
  const cs = el ? getComputedStyle(el) : null;
  return {
    tag: el?.tagName, role: el?.getAttribute("role"), label: el?.getAttribute("aria-label") ?? el?.textContent?.trim().slice(0, 40),
    inDialog: !!el?.closest('[role="dialog"]'), ring: cs ? cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 : false,
  };
});
const status = (page) => page.evaluate(() => [...document.querySelectorAll('[role="status"]')].map((e) => e.textContent?.trim()).filter(Boolean).join(" | "));
/** 조건을 만족하는 요소에 닿을 때까지 Tab (최대 n번) */
async function tabTo(page, pred, n = 40) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("Tab");
    const a = await active(page);
    if (pred(a)) return a;
  }
  return null;
}
async function axe(page, label) {
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations
    .map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes[0]?.target.join(" ") })));
  const bad = v.filter((x) => (x.impact === "critical" || x.impact === "serious") && !IGNORE.has(x.id));
  for (const x of v) console.log(`   · ${x.impact} ${x.id} ×${x.n} (${x.t})${IGNORE.has(x.id) ? ` ⚠️ 세지 않음: ${OWNER_NOTE[x.id] ?? "--ignore"}` : ""}`);
  check(bad.length === 0, `axe ${label}: critical·serious ${bad.length}건`);
}

// ① axe
console.log("\n## axe");
for (const path of ["/", "/t/demo", "/t/prof-demo", "/t/demo?dday=7", "/?dday=0", "/t/demo?fill=40"]) {
  const page = await newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await axe(page, path);
  await page.context().close();
}

// ② 키보드
console.log("\n## 키보드: /t/demo?fill=40 (장식 열기·트리 넘김·별)");
{
  const page = await newPage();
  await page.goto(`${BASE}/t/demo?fill=40`, { waitUntil: "networkidle" });
  const orn = await tabTo(page, (a) => a.label?.includes("장식"));
  check(!!orn && orn.ring, `Tab 으로 장식에 닿고 포커스 링이 보임 (${orn?.label})`);
  check(!!orn?.label?.includes("12월 25일에 열려요"), "공개 전 장식 이름에 잠김 안내");
  await shot(page, "1-tree-focus-ornament");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  check((await status(page)).includes("크리스마스"), "잠긴 장식을 누르면 알림 영역에 안내");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  check((await status(page)).includes("2번째"), "← / → 로 트리 넘김 (알림: 2번째 트리)");
  const next = await tabTo(page, (a) => a.label === "다음 트리");
  check(!!next?.ring, "Tab 으로 '다음 트리' 버튼, 포커스 링");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  check((await status(page)).includes("3번째"), "'다음 트리' Enter 로 넘김");
  const size = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="트리 넘기기"] button')].map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  check(size.length > 0 && size.every((s) => s >= 44), `트리 넘김 버튼 44px 이상 (${size.map(Math.round).join(", ")})`);
  await shot(page, "2-tree-paged");

  await page.goto(`${BASE}/t/demo`, { waitUntil: "networkidle" });
  const star = await tabTo(page, (a) => a.label?.startsWith("트리 꼭대기 별"));
  check(!!star, "Tab 으로 별에 닿음");
  for (let i = 0; i < 7; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(60); }
  const after = await active(page);
  check(after.label?.startsWith("트리 꼭대기 별"), "별을 7번 눌러도 포커스가 별에 남음");
  check((await status(page)).includes("산타"), "7연타 알림을 알림 영역에서 읽음");
  const ponix = await tabTo(page, (a) => a.label?.startsWith("포닉스"));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  check(!!ponix && (await active(page)).label?.startsWith("포닉스"), "포닉스 Enter 후에도 포커스 유지");
  const targets = await page.evaluate(() => [...document.querySelectorAll('button[aria-label]')].filter((b) => /장식|별|포닉스/.test(b.getAttribute("aria-label") ?? ""))
    .map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  check(targets.every((s) => s >= 44), `장식·별·포닉스 터치 영역 44px 이상 (최소 ${Math.round(Math.min(...targets))}px)`);
  await page.context().close();
}

console.log("\n## 키보드: /t/demo/write (2단계 끝까지)");
{
  const page = await newPage();
  // 데모 트리 id("demo")는 UUID 가 아니라 /api/letters 가 데모 분기 전에 404 를 준다 (서버 담당에 보고).
  // 여기서는 클라이언트 키보드 흐름만 보려고 성공 응답으로 바꿔 둔다.
  await page.route("**/api/letters", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"demo":true}' }));
  await page.goto(`${BASE}/t/demo/write`, { waitUntil: "networkidle" });
  const tab = await tabTo(page, (a) => a.role === "tab");
  check(!!tab?.ring, `Tab 으로 장식 종류 탭 (${tab?.label})`);
  await page.keyboard.press("ArrowRight");
  const tab2 = await active(page);
  const selected = await page.evaluate(() => document.activeElement?.getAttribute("aria-selected"));
  check(tab2.role === "tab" && tab2.label !== tab?.label && selected === "true", `→ 로 다음 탭 고르기 (${tab2.label})`);
  await page.keyboard.press("Tab");
  const pick = await active(page);
  check(!pick.role && pick.tag === "BUTTON", `탭 다음 Tab 은 장식 칸으로 (${pick.label})`);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  const pressed = await page.evaluate(() => document.activeElement?.getAttribute("aria-pressed"));
  check(pressed === "true", "Enter 로 장식 고르기");
  await shot(page, "3-write-step1");
  const go = await tabTo(page, (a) => a.label?.includes("이 장식으로 편지 쓰기"));
  check(!!go, "'이 장식으로 편지 쓰기'에 닿음");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const h = await active(page);
  check(h.tag === "H1", "2단계로 가면 제목에 포커스");
  const nick = await tabTo(page, (a) => a.tag === "INPUT");
  check(!!nick?.ring, "닉네임 입력창 포커스 링");
  await page.keyboard.type("키보드 산타");
  await page.keyboard.press("Tab");
  check((await active(page)).tag === "TEXTAREA", "Tab → 편지 입력창");
  await page.keyboard.type("키보드만으로 쓴 편지");
  await shot(page, "4-write-step2");
  const submit = await tabTo(page, (a) => a.label?.includes("트리에 달기"));
  check(!!submit?.ring, "'트리에 달기' 포커스 링");
  await page.keyboard.press("Enter");
  const ok = await page.waitForURL(/added=1/, { timeout: 8000 }).then(() => true, () => false);
  check(ok, "Enter 로 보내고 트리로 돌아감 (?added=1)");
  await page.context().close();
}

console.log("\n## 키보드: /t/demo?owner=1&dday=0 (편지 창)");
{
  const page = await newPage();
  await page.goto(`${BASE}/t/demo?owner=1&dday=0`, { waitUntil: "networkidle" });
  const orn = await tabTo(page, (a) => a.label?.includes("장식"));
  check(!!orn && !orn.label.includes("12월 25일"), `공개 후 장식 이름 (${orn?.label})`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  check((await active(page)).inDialog, "열면 포커스가 창 안으로 (봉투 단계)");
  await page.waitForTimeout(700);
  const close = await active(page);
  check(close.label === "닫기" && close.ring, "봉투가 펼쳐지면 '닫기'에 포커스");
  await axe(page, "편지 창");
  await shot(page, "5-letter-open");
  let inside = true;
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Tab"); inside &&= (await active(page)).inDialog; }
  await page.keyboard.press("Shift+Tab");
  inside &&= (await active(page)).inDialog;
  check(inside, "Tab·Shift+Tab 이 창 안에서만 돔");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  const back = await active(page);
  const gone = await page.locator('[role="dialog"]').count();
  check(gone === 0 && back.label === orn?.label, `Esc 로 닫고 연 장식으로 포커스 복귀 (${back.label})`);
  await shot(page, "6-letter-closed");
  await page.context().close();
}

// ③ 동작 줄이기
console.log("\n## prefers-reduced-motion");
{
  const page = await newPage({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/t/demo?dday=0`, { waitUntil: "networkidle" });
  const loops = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations === Infinity).length);
  check((await loops()) === 0, "계속 도는 애니메이션 0개 (12/25 화면)");
  const star = page.getByRole("button", { name: /트리 꼭대기 별/ });
  for (let i = 0; i < 7; i++) await star.click();
  await page.waitForTimeout(150);
  const sleigh = await page.evaluate(() => { const el = document.querySelector(".sleigh"); return el ? getComputedStyle(el).display : "없음"; });
  check(sleigh === "none" || sleigh === "없음", `별 7연타 후 썰매 안 보임 (display: ${sleigh})`);
  check((await loops()) === 0, "체이스 중에도 계속 도는 애니메이션 0개");
  await page.context().close();
}

await browser.close();
console.log(failures.length ? `\n실패 ${failures.length}건` : "\n모두 통과");
process.exit(failures.length ? 1 : 0);
