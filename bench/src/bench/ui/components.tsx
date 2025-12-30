import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { ModelDefinition } from "../models";
import type { ExistingResult } from "../save";
import type { ModelStats, RecentError, SuiteChoice } from "./types";
import { formatRowData, pad, padLeft, pctColor } from "./utils";

// Header component
export function Header({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyanBright">
        {title}
      </Text>
      {subtitle && <Text color="gray">{subtitle}</Text>}
    </Box>
  );
}

// Progress bar component
export function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const stdout = process.stdout as { columns?: number };
  const width =
    typeof stdout.columns === "number"
      ? Math.max(20, Math.min(60, stdout.columns - 30))
      : 40;

  const ratio = total > 0 ? completed / total : 0;
  const filled = Math.round(width * ratio);
  const empty = width - filled;
  const percent = total > 0 ? Math.floor(ratio * 100) : 0;

  return (
    <Text>
      [<Text color="green">{"█".repeat(filled)}</Text>
      <Text color="gray">{"░".repeat(empty)}</Text>]{" "}
      <Text color="cyan">{percent}%</Text> (
      <Text color="green">{completed}</Text>/<Text color="white">{total}</Text>)
    </Text>
  );
}

// Suite selector component
export function SuiteSelector({
  suites,
  onSelect,
}: {
  suites: SuiteChoice[];
  onSelect: (id: string) => void;
}) {
  return (
    <Box flexDirection="column">
      <Header subtitle="Select a benchmark suite to run" title="MazeBench" />
      <SelectInput
        items={suites.map((s) => ({
          key: s.id,
          label: `${s.name}${s.description ? ` — ${s.description}` : ""}`,
          value: s.id,
        }))}
        onSelect={(item) => onSelect(item.value)}
      />
    </Box>
  );
}

// Model selector component with checkboxes
export function ModelSelector({
  models,
  selectedModels,
  existingResults,
  onToggle,
  onConfirm,
}: {
  models: ModelDefinition[];
  selectedModels: Set<string>;
  existingResults: Map<string, ExistingResult>;
  onToggle: (modelKey: string) => void;
  onConfirm: () => void;
}) {
  const items = [
    ...models.map((m) => {
      const key = `[${m.creator}]${m.model.split("/").pop()}${m.reasoning ? `-${m.reasoning}` : ""}`;
      const isSelected = selectedModels.has(key);
      const existing = existingResults.get(key);

      let resultIndicator = "";
      if (existing) {
        const successPct = (existing.successRate * 100).toFixed(0);
        resultIndicator = ` ✅ ${successPct}% on ${existing.totalRuns} runs`;
      }

      return {
        key,
        label: `${isSelected ? "[x]" : "[ ]"} ${m.displayName} (${m.creator})${resultIndicator}`,
        value: key,
      };
    }),
    {
      key: "__confirm__",
      label: ">>> Start Benchmark <<<",
      value: "__confirm__",
    },
  ];

  return (
    <Box flexDirection="column">
      <Header
        subtitle={`${selectedModels.size} model(s) selected - Space to toggle, Enter to confirm`}
        title="Select Models"
      />
      <SelectInput
        items={items}
        onSelect={(item) => {
          if (item.value === "__confirm__") {
            if (selectedModels.size > 0) {
              onConfirm();
            }
          } else {
            onToggle(item.value);
          }
        }}
      />
    </Box>
  );
}

// Results table component
export function ResultsTable({
  modelOrder,
  stats,
}: {
  modelOrder: string[];
  stats: Record<string, ModelStats>;
}) {
  const header = [
    "Model",
    "Tests",
    "% Right",
    "Errors",
    "Running",
    "Avg Cost",
    "Total Cost",
    "Avg Tokens",
    "Avg Duration",
    "Slowest",
  ] as const;

  const rows = modelOrder.map((name) => formatRowData(name, stats[name]));

  const widths = {
    model: Math.max(header[0].length, ...rows.map((r) => r.model.length)),
    tests: Math.max(header[1].length, ...rows.map((r) => r.tests.length)),
    correct: Math.max(header[2].length, ...rows.map((r) => r.correct.length)),
    err: Math.max(header[3].length, ...rows.map((r) => r.err.length)),
    running: Math.max(header[4].length, ...rows.map((r) => r.running.length)),
    avgCost: Math.max(header[5].length, ...rows.map((r) => r.avgCost.length)),
    totalCost: Math.max(
      header[6].length,
      ...rows.map((r) => r.totalCost.length)
    ),
    avgTokens: Math.max(
      header[7].length,
      ...rows.map((r) => r.avgTokens.length)
    ),
    avg: Math.max(header[8].length, ...rows.map((r) => r.avg.length)),
    slow: Math.max(header[9].length, ...rows.map((r) => r.slow.length)),
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text bold color="whiteBright">
          {pad(header[0], widths.model)}
        </Text>
        {"  "}
        <Text bold color="whiteBright">
          {pad(header[1], widths.tests)}
        </Text>
        {"  "}
        <Text bold color="whiteBright">
          {pad(header[2], widths.correct)}
        </Text>
        {"  "}
        <Text bold color="whiteBright">
          {pad(header[3], widths.err)}
        </Text>
        {"  "}
        <Text bold color="whiteBright">
          {pad(header[4], widths.running)}
        </Text>
        {"  "}
        <Text bold color="whiteBright">
          {pad(header[5], widths.avgCost)}
        </Text>
        {"  "}
        <Text bold color="whiteBright">
          {pad(header[6], widths.totalCost)}
        </Text>
        {"  "}
        <Text bold color="whiteBright">
          {pad(header[7], widths.avgTokens)}
        </Text>
        {"  "}
        <Text bold color="whiteBright">
          {pad(header[8], widths.avg)}
        </Text>
        {"  "}
        <Text bold color="whiteBright">
          {pad(header[9], widths.slow)}
        </Text>
      </Text>

      <Text color="gray">
        {"─".repeat(Object.values(widths).reduce((a, b) => a + b, 0) + 18)}
      </Text>

      {rows.map((r) => (
        <Text key={r.model}>
          <Text color="whiteBright">{pad(r.model, widths.model)}</Text>
          {"  "}
          <Text color="white">{padLeft(r.tests, widths.tests)}</Text>
          {"  "}
          <Text color={r.pct === null ? "gray" : pctColor(r.pct)}>
            {padLeft(r.correct, widths.correct)}
          </Text>
          {"  "}
          <Text color={r.err === "-" ? "gray" : "red"}>
            {padLeft(r.err, widths.err)}
          </Text>
          {"  "}
          <Text color={r.running === "-" ? "gray" : "yellow"}>
            {padLeft(r.running, widths.running)}
          </Text>
          {"  "}
          <Text color={r.avgCost === "-" ? "gray" : "green"}>
            {padLeft(r.avgCost, widths.avgCost)}
          </Text>
          {"  "}
          <Text color={r.totalCost === "-" ? "gray" : "green"}>
            {padLeft(r.totalCost, widths.totalCost)}
          </Text>
          {"  "}
          <Text color={r.avgTokens === "-" ? "gray" : "blue"}>
            {padLeft(r.avgTokens, widths.avgTokens)}
          </Text>
          {"  "}
          <Text color={r.avg === "-" ? "gray" : "cyan"}>
            {padLeft(r.avg, widths.avg)}
          </Text>
          {"  "}
          <Text color={r.slow === "-" ? "gray" : "magenta"}>
            {padLeft(r.slow, widths.slow)}
          </Text>
        </Text>
      ))}
    </Box>
  );
}

// Stats summary component
export function StatsSummary({
  completed,
  total,
  overallPct,
  errors,
  runningCount,
  overallAvgSec,
  totalCost,
}: {
  completed: number;
  total: number;
  overallPct: number | null;
  errors: number;
  runningCount: number;
  overallAvgSec: number | null;
  totalCost: number;
}) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="gray">{"─".repeat(80)}</Text>
      <Box>
        <Text>
          <Text bold>Progress:</Text> <Text color="green">{completed}</Text>/
          <Text color="white">{total}</Text> done
          {"  "}
          <Text bold>Success:</Text>{" "}
          <Text color={overallPct === null ? "gray" : pctColor(overallPct)}>
            {overallPct === null ? "-" : `${overallPct}%`}
          </Text>
          {"  "}
          <Text bold>Errors:</Text>{" "}
          <Text color={errors > 0 ? "red" : "gray"}>{errors || "-"}</Text>
          {"  "}
          <Text bold>Running:</Text>{" "}
          <Text color={runningCount > 0 ? "yellow" : "gray"}>
            {runningCount || "-"}
          </Text>
        </Text>
      </Box>
      <Box>
        <Text>
          <Text bold>Avg Duration:</Text>{" "}
          <Text color={overallAvgSec === null ? "gray" : "cyan"}>
            {overallAvgSec === null ? "-" : `${overallAvgSec.toFixed(2)}s`}
          </Text>
          {"  "}
          <Text bold>Total Cost:</Text>{" "}
          <Text color="green">${totalCost.toFixed(4)}</Text>
        </Text>
      </Box>
    </Box>
  );
}

// Recent errors component
export function RecentErrors({ errors }: { errors: RecentError[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="red">
        Recent Errors:
      </Text>
      {errors.slice(-3).map((e, i) => (
        <Text color="redBright" dimColor key={`${e.model}-${e.timestamp}-${i}`}>
          [{e.model}] {e.error.slice(0, 80)}
          {e.error.length > 80 ? "..." : ""}
        </Text>
      ))}
    </Box>
  );
}

// Done banner component
export function DoneBanner({
  suiteId,
  successRate,
}: {
  suiteId: string;
  successRate: number | null;
}) {
  return (
    <Box
      borderColor="green"
      borderStyle="round"
      flexDirection="column"
      marginTop={1}
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="greenBright">
        Benchmark Complete!
      </Text>
      <Text>
        Suite: <Text color="magentaBright">{suiteId}</Text>
      </Text>
      {successRate !== null && (
        <Text>
          Overall Success Rate:{" "}
          <Text bold color={pctColor(successRate)}>
            {successRate.toFixed(1)}%
          </Text>
        </Text>
      )}
    </Box>
  );
}
