import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "crypto";
import { createAdminClient, isConfigured } from "@/lib/supabase/server";
import { isValidOrnament } from "@/lib/constants";
import { hasBannedWord } from "@/lib/moderation";

// 작성 제한은 submit_letter() 안에서 센다 (spec.md 4.4). 여기 숫자는 안내 문구용이 아니라
// 함수가 돌려준 오류 코드를 응답으로 바꾸는 데만 쓴다.
const ANON_COOKIE = "anon_id";
const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** submit_letter() 가 돌려준 제한 오류 → 사용자 문구 */
const LIMIT_MESSAGES: Record<string, string> = {
  rate_client_minute: "루돌프가 숨 고르는 중이에요. 잠시 후 다시 시도해주세요.",
  rate_client_tree_day: "이 트리에는 오늘 충분히 마음을 전했어요! 내일 또 와주세요.",
  rate_ip_minute: "지금 편지가 많이 몰렸어요. 잠시 후 다시 시도해주세요.",
};

/** IP·브라우저 ID 는 솔트 해시로만 저장한다 (spec.md 4.1) */
function hash(value: string) {
  return createHash("sha256").update(`${process.env.IP_HASH_SALT ?? ""}:${value}`).digest("hex");
}

/** anon_id 쿠키를 함께 실어 보낸다 — 없던 브라우저면 이 응답에서 발급된다 (httpOnly) */
function reply(body: Record<string, unknown>, status: number, anonId?: string) {
  const res = NextResponse.json(body, { status });
  if (anonId) {
    res.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ANON_COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "잘못된 요청이에요." }, 400);
  }

  const treeId = String(body.treeId ?? "");
  const content = String(body.content ?? "").trim();
  const nickname = String(body.nickname ?? "").trim().slice(0, 20) || "익명의 산타";
  const isConfession = body.isConfession === true;
  const ornamentType = String(body.ornamentType ?? "");

  // 실서버는 UUID 형식만 받는다. 데모 트리 id("demo", "demo-prof")는 UUID가 아니므로
  // 데모 모드에서는 빈 값만 거절하고, 아래 검증은 실서버와 똑같이 거친다 (spec.md 5.2)
  const validTreeId = isConfigured ? UUID.test(treeId) : treeId.length > 0;
  if (!validTreeId) return reply({ error: "트리를 찾을 수 없어요." }, 404);
  if (!isValidOrnament(ornamentType)) return reply({ error: "장식을 골라주세요." }, 400);
  if (content.length < 1 || content.length > 1000)
    return reply({ error: "편지는 1~1000자로 써주세요." }, 400);
  if (hasBannedWord(content) || hasBannedWord(nickname))
    return reply({ error: "따뜻한 말로 다시 써볼까요? 🎄" }, 400);

  if (!isConfigured) return NextResponse.json({ ok: true, demo: true });

  // 브라우저 ID (httpOnly 쿠키). 쿠키를 지우면 새로 발급되지만, 그 경우는 IP 제한이 막는다 (spec.md 4.4)
  const sent = req.cookies.get(ANON_COOKIE)?.value ?? "";
  const anonId = UUID.test(sent) ? sent : randomUUID();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

  const admin = createAdminClient();

  // 검증 → 해시 → submit_letter() 1회 (트리 확인·작성 제한·저장을 DB 한 트랜잭션에서)
  const { data, error } = await admin.rpc("submit_letter", {
    p_tree_id: treeId,
    p_ornament_type: ornamentType,
    p_nickname: nickname,
    p_content: content,
    p_is_confession: isConfession,
    p_ip_hash: hash(ip),
    p_client_hash: hash(anonId),
  });

  if (error) return reply({ error: "편지를 달지 못했어요. 다시 시도해주세요." }, 500, anonId);

  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (result.ok !== true) {
    const reason = result.error ?? "";
    if (reason === "tree_not_found") return reply({ error: "트리를 찾을 수 없어요." }, 404, anonId);
    const limited = LIMIT_MESSAGES[reason];
    if (limited) return reply({ error: limited }, 429, anonId);
    // invalid_content · invalid_ornament 등 — API 검증을 통과했는데 DB 가 거부한 경우
    return reply({ error: "편지를 달지 못했어요. 다시 시도해주세요." }, 400, anonId);
  }

  return reply({ ok: true }, 200, anonId);
}
