import type { Metadata } from "next";
import LegacyPage from "@/components/LegacyPage";
import { getNotFoundPage } from "@/lib/cms";

export const metadata: Metadata = { title: { absolute: "Page not found – Bridge and Value" } };

export default async function NotFound() {
  const page = await getNotFoundPage();
  return page ? <LegacyPage page={page} /> : <h1>Page not found</h1>;
}
