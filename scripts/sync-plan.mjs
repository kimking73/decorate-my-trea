#!/usr/bin/env node
// 타임라인(기준)의 작업 목록으로 plan.md의 <!-- timeline:start --> ~ <!-- timeline:end --> 사이를 다시 만든다.
// 사용법: node scripts/sync-plan.mjs <타임라인 HTML 또는 state JSON 파일> [plan.md 경로]
// 타임라인 HTML은 페이지의 <script type="application/json" id="state"> 블록을 읽는다. (spec.md 7장)
import { readFileSync, writeFileSync } from "node:fs";

const [src, planPath = "plan.md"] = process.argv.slice(2);
if (!src) {
  console.error("사용법: node scripts/sync-plan.mjs <타임라인 HTML 또는 state JSON> [plan.md]");
  process.exit(1);
}

const raw = readFileSync(src, "utf8");
const m = raw.match(/<script type="application\/json" id="state">([\s\S]*?)<\/script>/);
const state = JSON.parse(m ? m[1] : raw);

const START = "<!-- timeline:start -->";
const END = "<!-- timeline:end -->";
const EMOJI = { D: "🎨", F: "🖥", S: "🛠", C: "📱", T: "👥" };
const WD = ["일", "월", "화", "수", "목", "금", "토"];

const day = (s) => { const [y, mo, d] = s.split("-").map(Number); return Date.UTC(y, mo - 1, d); };
const md = (s) => { const t = new Date(day(s)); return `${t.getUTCMonth() + 1}/${t.getUTCDate()}(${WD[t.getUTCDay()]})`; };
const span = (t) => (t.s === t.e ? md(t.s) : `${md(t.s)}–${md(t.e)}`);
const clean = (x) => String(x ?? "").replace(/\s+/g, " ").trim();

// 작업은 끝나는 날이 속한 마일스톤 구간에 넣는다.
const ms = [...state.milestones].sort((a, b) => day(a.d) - day(b.d));
function phase(t) {
  for (const x of ms) if (day(t.e) <= day(x.d)) return x;
  return null;
}
function phaseTitle(x) {
  if (!x) return "이후";
  const t = new Date(day(x.d));
  return `~${t.getUTCMonth() + 1}/${t.getUTCDate()} ${x.n}`;
}

function taskLines(t) {
  const head = [`**${t.id}** ${clean(t.t)}`, span(t)];
  if (t.dep?.length) head.push(`선행: ${t.dep.join(", ")}`);
  const out = [`- [${t.c ? "x" : " "}] ${head.join(" · ")}${t.key ? " ⭐" : ""}`];
  if (clean(t.sum)) out.push(`  - ${clean(t.sum)}`);
  if (t.w?.length) {
    out.push("  - 할 일");
    for (const w of t.w) out.push(`    - ${clean(w)}`);
  }
  if (t.out?.length) out.push(`  - 산출물: ${t.out.map(clean).join(", ")}`);
  if (clean(t.done)) out.push(`  - 완료 기준: ${clean(t.done)}`);
  return out;
}

const now = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST
const lines = [
  START,
  `<!-- 타임라인에서 생성됨 (${now}). 손으로 고치지 말고 타임라인을 고친 뒤 scripts/sync-plan.mjs를 실행하세요. -->`,
  "",
];
const total = state.tasks.length;
const done = state.tasks.filter((t) => t.c).length;
lines.push(`> 타임라인 동기화: ${now} · 작업 ${total}개 중 ${done}개 완료 · ⭐ 핵심 작업`, "");

for (const lane of state.lanes) {
  const ts = state.tasks
    .filter((t) => t.l === lane.k)
    .sort((a, b) => day(a.s) - day(b.s) || day(a.e) - day(b.e) || a.id.localeCompare(b.id, "en", { numeric: true }));
  if (!ts.length) continue;
  lines.push(`## ${EMOJI[lane.k] ?? ""} ${lane.n} · ${lane.who || "(담당 미정)"}`.replace(/^##\s+/, "## "));
  if (clean(lane.d)) lines.push(`> ${clean(lane.d)}`);
  const groups = new Map();
  for (const t of ts) {
    const key = phaseTitle(phase(t));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  for (const [title, list] of groups) {
    lines.push(`### ${title}`);
    for (const t of list) lines.push(...taskLines(t));
  }
  lines.push("");
}
lines.push(END);

const plan = readFileSync(planPath, "utf8");
const a = plan.indexOf(START);
const b = plan.indexOf(END);
if (a < 0 || b < a) {
  console.error(`${planPath}에 ${START} / ${END} 마커가 없습니다.`);
  process.exit(1);
}
writeFileSync(planPath, plan.slice(0, a) + lines.join("\n") + plan.slice(b + END.length));
console.log(`${planPath}: 작업 ${total}개 (${done}개 완료) 동기화`);
