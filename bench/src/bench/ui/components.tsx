import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import React from "react";
import type { ModelStats, SuiteChoice } from "./types";
import { formatRowData, pad, padLeft, pctColor } from "./utils";

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

export function SuiteSelector({
  suites,
  onSelect,
}: {
  suites: SuiteChoice[];
  onSelect: (id: string) => void;
}) {
  return (
    <Box flexDirection="column">
      <Text>Select a suite:</Text>
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

export function VersionInput({
  version,
  onChange,
  onSubmit,
}: {
  version: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Box flexDirection="column">
      <Text>Version label (press Enter to start):</Text>
      <Box marginTop={1}>
        <TextInput onChange={onChange} onSubmit={onSubmit} value={version} />
      </Box>
    </Box>
  );
}

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
    avgTokens: Math.max(
      header[6].length,
      ...rows.map((r) => r.avgTokens.length)
    ),
    avg: Math.max(header[7].length, ...rows.map((r) => r.avg.length)),
    slow: Math.max(header[8].length, ...rows.map((r) => r.slow.length)),
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text color="whiteBright" underline>
          {pad(header[0], widths.model)}
        </Text>
        {"  "}
        <Text color="whiteBright" underline>
          {pad(header[1], widths.tests)}
        </Text>
        {"  "}
        <Text color="whiteBright" underline>
          {pad(header[2], widths.correct)}
        </Text>
        {"  "}
        <Text color="whiteBright" underline>
          {pad(header[3], widths.err)}
        </Text>
        {"  "}
        <Text color="whiteBright" underline>
          {pad(header[4], widths.running)}
        </Text>
        {"  "}
        <Text color="whiteBright" underline>
          {pad(header[5], widths.avgCost)}
        </Text>
        {"  "}
        <Text color="whiteBright" underline>
          {pad(header[6], widths.avgTokens)}
        </Text>
        {"  "}
        <Text color="whiteBright" underline>
          {pad(header[7], widths.avg)}
        </Text>
        {"  "}
        <Text color="whiteBright" underline>
          {pad(header[8], widths.slow)}
        </Text>
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
