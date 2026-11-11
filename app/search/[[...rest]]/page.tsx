import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegacyPage from "@/components/LegacyPage";
import { renderSearch } from "@/lib/blog";

// WordPress-style search (/?s=term is rewritten here by middleware.ts).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ rest?: string[] }>; searchParams: Promise<{ s?: string }> };

const pageOf = (rest?: string[]) => (!rest?.length ? 1 : rest.length === 2 && rest[0] === "page" && /^\d+$/.test(rest[1]) ? Number(rest[1]) : NaN);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const r = await renderSearch((await searchParams).s ?? "", pageOf((await params).rest) || 1);
  return { title: { absolute: r.title }, robots: { index: false, follow: true } };
}

export default async function Search({ params, searchParams }: Props) {
  const page = pageOf((await params).rest);
  if (!page) notFound();
  return <LegacyPage page={await renderSearch((await searchParams).s ?? "", page)} />;
}
