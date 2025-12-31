"use client";

import { useAtomValue } from "jotai";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { computeModelMetricsPoints, type ModelMetricsPoint } from "@/lib/stats";
import type { BenchmarkReport } from "@/lib/types";
import {
  complexityFilterAtom,
  observationModeFilterAtom,
  sizeFilterAtom,
} from "@/store/filters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface PerformanceChartsProps {
  reports: Map<string, BenchmarkReport>;
}

const CREATOR_COLORS: Record<string, string> = {
  google: "#4285F4",
  openai: "#10a37f",
  "x-ai": "#1f2937",
  anthropic: "#d97757",
  meta: "#0668E1",
  mistral: "#facc15",
  cohere: "#395144",
};

const CHART_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

function getCreatorColor(creator: string): string {
  const creatorLower = creator.toLowerCase();
  if (CREATOR_COLORS[creatorLower]) {
    return CREATOR_COLORS[creatorLower];
  }

  let hash = 0;
  for (let i = 0; i < creatorLower.length; i++) {
    const charCode = creatorLower.charCodeAt(i);
    hash = charCode + hash * 31;
  }
  const index = Math.abs(hash) % CHART_COLORS.length;
  return CHART_COLORS[index];
}

function getModelColor(creator: string): string {
  return getCreatorColor(creator);
}

function EmptyState() {
  return (
    <div className="text-muted-foreground text-sm">
      No runs match current filters.
    </div>
  );
}

function ModelLegend({ data }: { data: ModelMetricsPoint[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:text-xs">
      {data.map((entry) => (
        <div className="flex items-center gap-1.5" key={entry.model}>
          <div
            className="h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3"
            style={{ backgroundColor: getModelColor(entry.creator) }}
          />
          <span className="max-w-35 truncate sm:max-w-none">
            {entry.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PerformanceCharts({ reports }: PerformanceChartsProps) {
  const complexityFilter = useAtomValue(complexityFilterAtom);
  const sizeFilter = useAtomValue(sizeFilterAtom);
  const observationModeFilter = useAtomValue(observationModeFilterAtom);

  const data = computeModelMetricsPoints(
    reports,
    complexityFilter,
    sizeFilter,
    observationModeFilter
  );

  const hasAnyRuns = data.some((d) => d.nRuns > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-base sm:text-lg">Charts</h2>
      </div>

      {hasAnyRuns ? <ModelLegend data={data} /> : null}

      <Tabs defaultValue="srate">
        <TabsList>
          <TabsTrigger value="srate">Success Rate</TabsTrigger>
          <TabsTrigger value="composite">Composite Score</TabsTrigger>
        </TabsList>

        <TabsContent value="srate">
          <SuccessRateBarCard data={data} showEmpty={!hasAnyRuns} />
        </TabsContent>
        <TabsContent value="composite">
          <CompositeScoreBarCard data={data} showEmpty={!hasAnyRuns} />
        </TabsContent>
      </Tabs>

      <Tabs defaultValue="time">
        <TabsList>
          {/* <TabsTrigger value="steps">Steps</TabsTrigger> */}
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="cost">Total Cost</TabsTrigger>
        </TabsList>

        {/* <TabsContent value="steps"> */}
        {/*   <StepsVsSuccessCard data={data} showEmpty={!hasAnyRuns} /> */}
        {/* </TabsContent> */}
        <TabsContent value="time">
          <TimeVsSuccessCard data={data} showEmpty={!hasAnyRuns} />
        </TabsContent>
        {/* <TabsContent value="avg-cost"> */}
        {/*   <AvgCostVsSuccessCard data={data} showEmpty={!hasAnyRuns} /> */}
        {/* </TabsContent> */}
        <TabsContent value="cost">
          <TotalCostVsSuccessCard data={data} showEmpty={!hasAnyRuns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompositeScoreBarCard({
  data,
  showEmpty,
}: {
  data: ModelMetricsPoint[];
  showEmpty: boolean;
}) {
  const chartConfig = {
    compositeScore: { label: "Composite Score", color: CHART_COLORS[4] },
  } satisfies ChartConfig;

  // Sort by composite score for this chart
  const sortedData = [...data].sort(
    (a, b) => b.compositeScore - a.compositeScore
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm sm:text-base">
          Composite Score by Model
        </CardTitle>
        <p className="text-[11px] text-muted-foreground sm:text-xs">
          Success Rate x Efficiency
        </p>
      </CardHeader>
      <CardContent>
        {showEmpty ? (
          <EmptyState />
        ) : (
          <ChartContainer className="h-72 w-full sm:h-80" config={chartConfig}>
            <BarChart
              data={sortedData}
              margin={{ left: 4, right: 4, top: 12, bottom: 30 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                angle={-30}
                dataKey="displayName"
                height={50}
                interval={0}
                textAnchor="end"
                tick={{ fontSize: 10 }}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const entry = payload?.[0]?.payload as ModelMetricsPoint;
                      return entry?.displayName ?? "";
                    }}
                  />
                }
                cursor={false}
                formatter={(v, _name, props) => {
                  const entry = props?.payload as ModelMetricsPoint;
                  return [
                    <div className="space-y-1" key="composite">
                      <div>Score: {Number(v).toFixed(1)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {entry.successRatePct.toFixed(0)}% success x{" "}
                        {entry.avgEfficiencyScore.toFixed(2)} efficiency
                      </div>
                    </div>,
                    "",
                  ];
                }}
              />
              <Bar dataKey="compositeScore" radius={[4, 4, 0, 0]}>
                {sortedData.map((entry) => (
                  <Cell fill={getModelColor(entry.creator)} key={entry.model} />
                ))}
                <LabelList
                  dataKey="nSuccesses"
                  formatter={(v: number) => `n=${v}`}
                  position="top"
                  style={{
                    fontSize: 9,
                    fill: "var(--muted-foreground)",
                  }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function SuccessRateBarCard({
  data,
  showEmpty,
}: {
  data: ModelMetricsPoint[];
  showEmpty: boolean;
}) {
  const chartConfig = {
    successRatePct: { label: "Success rate (%)", color: CHART_COLORS[0] },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm sm:text-base">
          Success Rate by Model
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showEmpty ? (
          <EmptyState />
        ) : (
          <ChartContainer className="h-72 w-full sm:h-80" config={chartConfig}>
            <BarChart
              data={data}
              margin={{ left: 4, right: 4, top: 12, bottom: 30 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                angle={-30}
                dataKey="displayName"
                height={50}
                interval={0}
                textAnchor="end"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const entry = payload?.[0]?.payload as ModelMetricsPoint;
                      return entry?.displayName ?? "";
                    }}
                  />
                }
                cursor={false}
                formatter={(v) => `${Number(v).toFixed(1)}%`}
              />
              <Bar dataKey="successRatePct" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell fill={getModelColor(entry.creator)} key={entry.model} />
                ))}
                <LabelList
                  dataKey="nRuns"
                  formatter={(v: number) => `n=${v}`}
                  position="top"
                  style={{
                    fontSize: 9,
                    fill: "var(--muted-foreground)",
                  }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function BaseScatterCard({
  title,
  subtitle,
  xKey,
  xLabel,
  xFormatter,
  chartColor,
  data,
  showEmpty,
}: {
  title: string;
  subtitle: string;
  xKey: keyof ModelMetricsPoint;
  xLabel: string;
  xFormatter?: (v: number) => string;
  chartColor: string;
  data: ModelMetricsPoint[];
  showEmpty: boolean;
}) {
  const filteredData = data.filter((d) => d.nRuns > 0);

  const chartConfig = {
    [xKey]: { label: xLabel, color: chartColor },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
        <p className="text-[11px] text-muted-foreground sm:text-xs">
          {subtitle}
        </p>
      </CardHeader>
      <CardContent>
        {showEmpty || filteredData.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer className="h-72 w-full sm:h-80" config={chartConfig}>
            <ScatterChart margin={{ left: 8, right: 16, top: 30, bottom: 8 }}>
              <CartesianGrid />
              <XAxis
                dataKey={xKey}
                label={{
                  value: xLabel,
                  position: "bottom",
                  fontSize: 10,
                  offset: -4,
                }}
                tick={{ fontSize: 10 }}
                tickFormatter={xFormatter}
                type="number"
              />
              <YAxis
                dataKey="successRatePct"
                domain={[0, 100]}
                label={{
                  value: "Success Rate",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 10,
                }}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || payload?.length === 0) {
                    return null;
                  }
                  const entry = payload[0]?.payload as ModelMetricsPoint;
                  return (
                    <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                      <p className="mb-1 font-medium">{entry.displayName}</p>
                      <p>
                        {xLabel}:{" "}
                        {xFormatter
                          ? xFormatter(entry[xKey] as number)
                          : entry[xKey]}
                      </p>
                      <p>Success Rate: {entry.successRatePct.toFixed(1)}%</p>
                    </div>
                  );
                }}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter data={filteredData} isAnimationActive={false}>
                {filteredData.map((entry) => (
                  <Cell fill={getModelColor(entry.creator)} key={entry.model} />
                ))}
                <LabelList
                  className="hidden sm:block"
                  content={({ x, y, value }) => {
                    const text = String(value);
                    const maxWidth = 80;
                    // Simple wrap: split into chunks that fit
                    const words = text.split(/[-\s]/);
                    const lines: string[] = [];
                    let currentLine = "";
                    for (const word of words) {
                      const test = currentLine
                        ? `${currentLine} ${word}`
                        : word;
                      // Rough estimate: ~6px per char at fontSize 10
                      if (test.length * 6 > maxWidth && currentLine) {
                        lines.push(currentLine);
                        currentLine = word;
                      } else {
                        currentLine = test;
                      }
                    }
                    if (currentLine) {
                      lines.push(currentLine);
                    }

                    return (
                      <text
                        fill="var(--foreground)"
                        fontSize={10}
                        textAnchor="start"
                        x={Number(x)}
                        y={Number(y) - 8 - (lines.length - 1) * 12}
                      >
                        {lines.map((line, i) => (
                          <tspan dy={i === 0 ? 0 : 12} key={i} x={Number(x)}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                    );
                  }}
                  dataKey="displayName"
                  position="top"
                />
              </Scatter>
            </ScatterChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

interface ScatterCardProps {
  data: ModelMetricsPoint[];
  showEmpty: boolean;
}

// function StepsVsSuccessCard(props: ScatterCardProps) {
//   return (
//     <BaseScatterCard
//       {...props}
//       chartColor={CHART_COLORS[1]}
//       subtitle="How average steps relate to success rate"
//       title="Avg Steps vs Success Rate"
//       xFormatter={(v) => `${Number(v).toFixed(2)}`}
//       xKey="avgSteps"
//       xLabel="Avg Steps"
//     />
//   );
// }

function TimeVsSuccessCard(props: ScatterCardProps) {
  return (
    <BaseScatterCard
      {...props}
      chartColor={CHART_COLORS[2]}
      subtitle="How average time relates to success rate"
      title="Avg Time vs Success Rate"
      xFormatter={(v) => `${Number(v).toFixed(0)}s`}
      xKey="avgTimeSec"
      xLabel="Avg Time (s)"
    />
  );
}

function AvgCostVsSuccessCard(props: ScatterCardProps) {
  return (
    <BaseScatterCard
      {...props}
      chartColor={CHART_COLORS[3]}
      subtitle="Lower avg cost with high success rate is better (bottom-right)"
      title="Avg Cost per Run vs Success Rate"
      xFormatter={(v) => `$${Number(v).toFixed(4)}`}
      xKey="avgCostPerRun"
      xLabel="Avg Cost per Run ($)"
    />
  );
}

function TotalCostVsSuccessCard(props: ScatterCardProps) {
  return (
    <BaseScatterCard
      {...props}
      chartColor={CHART_COLORS[5]}
      subtitle="Total spend across all runs vs success rate"
      title="Total Cost vs Success Rate"
      xFormatter={(v) => `$${Number(v).toFixed(2)}`}
      xKey="totalCost"
      xLabel="Total Cost ($)"
    />
  );
}
