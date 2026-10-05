import { SuiteView } from "@/components/suite-view";
import { defaultSuite } from "@/lib/data";

export default function Home() {
  return <SuiteView suiteId={defaultSuite()} />;
}
