import { leaderboard, subjectItems } from "@/lib/data";
import { slug, unslug } from "@/lib/format";

// Per-model results as static JSON, fetched lazily by the replay viewer so model pages stay small.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return leaderboard()
    .filter((r) => r.subject.kind === "model")
    .map((r) => ({ file: `${slug(r.subject.key)}.json` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  return Response.json(subjectItems(unslug(file.replace(/\.json$/, ""))));
}
