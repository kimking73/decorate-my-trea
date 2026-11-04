import { notFound } from "next/navigation";
import WriteForm from "@/components/WriteForm";
import { getTreeBySlug } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function WritePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tree = await getTreeBySlug(slug);
  if (!tree) notFound();
  return (
    <WriteForm
      tree={{ id: tree.id, slug: tree.slug, title: tree.title, owner_name: tree.owner_name, theme: tree.theme, kind: tree.kind, department: tree.department }}
    />
  );
}
