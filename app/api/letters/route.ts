import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient, isConfigured } from "@/lib/supabase/server";
import { CONFESSION_ORNAMENT, isValidOrnament } from "@/lib/constants";
import { hasBannedWord } from "@/lib/moderation";

const PER_MINUTE = 5;
const PER_TREE_PER_DAY = 10;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const treeId = String(body.treeId ?? "");
  const content = String(body.content ?? "").trim();
  const nickname = String(body.nickname ?? "").trim().slice(0, 20) || "익명의 산타";
  const isConfession = body.isConfession === true;
  const ornamentType = isConfession ? CONFESSION_ORNAMENT.id : String(body.ornamentType ?? "");

  if (!treeId) return NextResponse.json({ error: "트리를 찾을 수 없어요." }, { status: 400 });
  if (!isValidOrnament(ornamentType)) return NextResponse.json({ error: "장식을 골라주세요." }, { status: 400 });
  if (content.length < 1 || content.length > 1000)
    return NextResponse.json({ error: "편지는 1~1000자로 써주세요." }, { status: 400 });
  if (hasBannedWord(content) || hasBannedWord(nickname))
    return NextResponse.json({ error: "따뜻한 말로 다시 써볼까요? 🎄" }, { status: 400 });

  if (!isConfigured) return NextResponse.json({ ok: true, demo: true });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(`${process.env.IP_HASH_SALT ?? ""}:${ip}`).digest("hex");

  const admin = createAdminClient();

  const { data: tree } = await admin.from("trees").select("id").eq("id", treeId).maybeSingle();
  if (!tree) return NextResponse.json({ error: "트리를 찾을 수 없어요." }, { status: 404 });

  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: recent }, { count: today }] = await Promise.all([
    admin.from("letters").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", oneMinAgo),
    admin.from("letters").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).eq("tree_id", treeId).gte("created_at", oneDayAgo),
  ]);
  if ((recent ?? 0) >= PER_MINUTE)
    return NextResponse.json({ error: "루돌프가 숨 고르는 중이에요. 잠시 후 다시 시도해주세요." }, { status: 429 });
  if ((today ?? 0) >= PER_TREE_PER_DAY)
    return NextResponse.json({ error: "이 트리에는 오늘 충분히 마음을 전했어요! 내일 또 와주세요." }, { status: 429 });

  const { error } = await admin.from("letters").insert({
    tree_id: treeId,
    ornament_type: ornamentType,
    nickname,
    content,
    is_confession: isConfession,
    ip_hash: ipHash,
  });
  if (error) return NextResponse.json({ error: "편지를 달지 못했어요. 다시 시도해주세요." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
