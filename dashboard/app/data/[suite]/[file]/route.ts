import { leaderboard, subjectItems, suites } from "@/lib/data";
import { slug, unslug } from "@/lib/format";

// Per-subject item results as static JSON, fetched lazily by the replay viewer so the
// model pages stay small.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return suites().flatMap((s) => leaderboard(s.id).map((r) => ({ suite: s.id, file: `${slug(r.subject.key)}.json` })));
}

export async function GET(_req: Request, { params }: { params: Promise<{ suite: string; file: string }> }) {
  const { suite, file } = await params;
  const key = unslug(file.replace(/\.json$/, ""));
  return Response.json(subjectItems(suite, key));
}
