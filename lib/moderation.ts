// 아주 기본적인 금칙어 필터. 운영하면서 추가하세요.
const BANNED = ["시발", "씨발", "ㅅㅂ", "병신", "ㅂㅅ", "좆", "개새", "꺼져", "죽어", "지랄"];

export function hasBannedWord(text: string): boolean {
  const t = text.replace(/\s+/g, "").toLowerCase();
  return BANNED.some((w) => t.includes(w));
}
