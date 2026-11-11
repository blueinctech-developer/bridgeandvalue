import { requireUser } from "@/lib/auth";
import { sql, type BlockRow } from "@/lib/db";
import BlockEditor from "../BlockEditor";
import Notice from "../Notice";

export const metadata = { title: "Footer" };

export default async function FooterPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const blocks = await sql<BlockRow>(`SELECT * FROM blocks WHERE page_id IS NULL ORDER BY position`);
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Footer</h1>
          <div className="sub">The footer is shared by every page. Changes here update the whole website.</div>
        </div>
      </div>
      <Notice sp={sp} />
      {blocks.map((b) => (
        <BlockEditor key={b.id} block={b} returnTo="/admin/footer/" />
      ))}
    </>
  );
}
