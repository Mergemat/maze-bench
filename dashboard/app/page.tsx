import { Dashboard } from "@/components/benchmark/dashboard";
import { loadBenchmarkReports } from "@/lib/loader";

export default async function Page() {
  const reports = await loadBenchmarkReports();

  return (
    <main className="container relative mx-auto px-4 py-8">
      <Dashboard reports={reports} />
    </main>
  );
}
