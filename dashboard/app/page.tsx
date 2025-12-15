import { Dashboard } from "@/components/benchmark/dashboard";
import { loadBenchmarkReports } from "@/lib/loader";

export default async function Page() {
  const reports = await loadBenchmarkReports();

  return (
    <main className="container mx-auto px-4 py-8 relative">
      <Dashboard reports={reports} />
    </main>
  );
}
