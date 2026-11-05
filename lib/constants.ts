// 공개 시각 (UI 표시용). 실제 열람 권한은 DB 의 app_config.reveal_at 으로 서버에서 강제된다.
export const REVEAL_AT = new Date(process.env.NEXT_PUBLIC_REVEAL_AT ?? "2026-12-25T00:00:00+09:00");

export const SITE_NAME = "포스텍 트리";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";


export type Ornament = {
  id: string;
  emoji: string;
  label: string;
  bg: string; // 장식 배경색
  group: "basic" | "postech" | "dept" | "secret";
};

export const ORNAMENTS: Ornament[] = [
  { id: "ball-red", emoji: "🔴", label: "빨간 방울", bg: "#ffd9d9", group: "basic" },
  { id: "ball-gold", emoji: "🟡", label: "금색 방울", bg: "#fff2c2", group: "basic" },
  { id: "star", emoji: "⭐", label: "별", bg: "#fff6cc", group: "basic" },
  { id: "gift", emoji: "🎁", label: "선물", bg: "#e8f1ff", group: "basic" },
  { id: "snowman", emoji: "⛄", label: "눈사람", bg: "#eef6ff", group: "basic" },
  { id: "bell", emoji: "🔔", label: "종", bg: "#fff1d6", group: "basic" },
  { id: "candy", emoji: "🍬", label: "사탕", bg: "#ffe3f1", group: "basic" },
  { id: "cookie", emoji: "🍪", label: "진저쿠키", bg: "#f6e6d4", group: "basic" },
  { id: "sock", emoji: "🧦", label: "양말", bg: "#ffe0e0", group: "basic" },
  { id: "deer", emoji: "🦌", label: "루돌프", bg: "#f1e4d8", group: "basic" },
  // POSTECH 테마
  { id: "jigok", emoji: "🍚", label: "지곡회관 학식", bg: "#fff4e0", group: "postech" },
  { id: "stairs77", emoji: "🪜", label: "77계단", bg: "#efe9ff", group: "postech" },
  { id: "aplus", emoji: "🅰️", label: "학점 A+", bg: "#ffe1e6", group: "postech" },
  { id: "coffee", emoji: "☕", label: "밤샘 커피", bg: "#efe2d6", group: "postech" },
  { id: "gwamegi", emoji: "🐟", label: "포항 과메기", bg: "#e0f0ff", group: "postech" },
  { id: "sea", emoji: "🌊", label: "영일대 바다", bg: "#dff5ff", group: "postech" },
  { id: "laptop", emoji: "💻", label: "과제 제출", bg: "#e9edf3", group: "postech" },
  { id: "flask", emoji: "🧪", label: "실험실", bg: "#e4fbe9", group: "postech" },
  { id: "bike", emoji: "🚲", label: "캠퍼스 자전거", bg: "#e6f7ef", group: "postech" },
  { id: "grad", emoji: "🎓", label: "졸업 기원", bg: "#ece8ff", group: "postech" },
];

// 교수님 트리 전용 장식
export const PROFESSOR_ORNAMENTS: Ornament[] = [
  { id: "chalk", emoji: "🖍️", label: "분필", bg: "#f4f4f4", group: "secret" },
  { id: "thanks", emoji: "🙇", label: "감사합니다", bg: "#fff1d6", group: "secret" },
  { id: "notebook", emoji: "📓", label: "필기노트", bg: "#e8f1ff", group: "secret" },
  { id: "apple", emoji: "🍎", label: "선생님께 사과", bg: "#ffe0e0", group: "secret" },
];

export const DEPARTMENTS: { id: string; name: string; emoji: string }[] = [
  { id: "mueunjae", name: "무은재학부", emoji: "🌱" },
  { id: "math", name: "수학과", emoji: "∑" },
  { id: "phys", name: "물리학과", emoji: "⚛️" },
  { id: "chem", name: "화학과", emoji: "⚗️" },
  { id: "life", name: "생명과학과", emoji: "🧬" },
  { id: "mse", name: "신소재공학과", emoji: "💎" },
  { id: "me", name: "기계공학과", emoji: "⚙️" },
  { id: "ime", name: "산업경영공학과", emoji: "📈" },
  { id: "ee", name: "전자전기공학과", emoji: "⚡" },
  { id: "cse", name: "컴퓨터공학과", emoji: "👾" },
  { id: "cheme", name: "화학공학과", emoji: "🛢️" },
  { id: "cite", name: "융합생명공학부", emoji: "🔬" },
  { id: "semi", name: "반도체공학과", emoji: "🔲" },
  { id: "ai", name: "인공지능학과", emoji: "🤖" },
  { id: "grad", name: "대학원생", emoji: "🧑‍🔬" },
  { id: "etc", name: "기타", emoji: "🎄" },
];

export function deptOrnament(deptId: string | null | undefined): Ornament | null {
  const d = DEPARTMENTS.find((x) => x.id === deptId);
  if (!d) return null;
  return { id: `dept-${d.id}`, emoji: d.emoji, label: d.name, bg: "#eaf7ee", group: "dept" };
}

export function findOrnament(id: string): Ornament {
  if (id.startsWith("dept-")) return deptOrnament(id.slice(5)) ?? ORNAMENTS[0];
  return [...ORNAMENTS, ...PROFESSOR_ORNAMENTS].find((o) => o.id === id) ?? ORNAMENTS[0];
}

export function isValidOrnament(id: string): boolean {
  if (id.startsWith("dept-")) return DEPARTMENTS.some((d) => `dept-${d.id}` === id);
  return [...ORNAMENTS, ...PROFESSOR_ORNAMENTS].some((o) => o.id === id);
}

export type ThemeId = "classic" | "snow" | "pink" | "night" | "postech" | "chalkboard";

export const THEMES: Record<ThemeId, { name: string; bg: string; tree: [string, string, string]; text: string }> = {
  classic: { name: "클래식", bg: "linear-gradient(#0f2a44, #1c4566)", tree: ["#1f7a45", "#23904f", "#2aa35a"], text: "#fff" },
  snow: { name: "눈꽃", bg: "linear-gradient(#a9c7e6, #e8f2fb)", tree: ["#4f8f7a", "#5ea38b", "#6fb89c"], text: "#16324f" },
  pink: { name: "핑크", bg: "linear-gradient(#ffb7c9, #ffe3ea)", tree: ["#e2738f", "#ec8aa3", "#f5a1b6"], text: "#5b1d2c" },
  night: { name: "오로라", bg: "linear-gradient(#0a0f2c, #253a6b 60%, #3d7a7a)", tree: ["#164e46", "#1b6358", "#227a6c"], text: "#fff" },
  postech: { name: "포스텍 레드", bg: "linear-gradient(#5a0f1f, #a01d32)", tree: ["#c8102e", "#d93a52", "#e9667a"], text: "#fff" },
  chalkboard: { name: "칠판 (교수님)", bg: "linear-gradient(#20372b, #2f4d3c)", tree: ["#e9efe9", "#f3f6f3", "#ffffff"], text: "#f3f6f3" },
};

// 숨은 키워드 이스터에그
export const KEYWORD_EGGS: { words: string[]; effect: "confetti" | "cry" | "aplus" | "heart"; message: string }[] = [
  { words: ["종강"], effect: "confetti", message: "🎉 종강 축하해요! 폭죽 발사!" },
  { words: ["과제", "레포트", "랩실"], effect: "cry", message: "😭 장식도 과제 생각에 울고 있어요..." },
  { words: ["학점", "a+", "에이쁠"], effect: "aplus", message: "🅰️ A+ 기운을 담아 보냈어요!" },
  { words: ["사랑해", "좋아해", "보고싶"], effect: "heart", message: "💗 두근두근... 마음이 전해지길!" },
];

export function findKeywordEgg(text: string) {
  const t = text.toLowerCase();
  return KEYWORD_EGGS.find((e) => e.words.some((w) => t.includes(w)));
}
