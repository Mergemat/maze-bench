import { notFound } from "next/navigation";
import { SuiteView } from "@/components/suite-view";
import { suites } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return suites().map((s) => ({ suite: s.id }));
}

export default async function SuitePage({ params }: { params: Promise<{ suite: string }> }) {
  const { suite } = await params;
  if (!suites().some((s) => s.id === suite)) {
    notFound();
  }
  return <SuiteView suiteId={suite} />;
}
