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
import { formatModelName } from "@/lib/utils";
import {
  complexityFilterAtom,
  sizeFilterAtom,
  visionFilterAtom,
} from "@/store/filters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

type PerformanceChartsProps = {
  reports: Map<string, BenchmarkReport>;
};

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

function getCreator(model: string): string {
  const match = model.match(/^\[(.*?)\]/);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  return "unknown";
}

function getModelColor(model: string): string {
  const creator = getCreator(model);
  if (CREATOR_COLORS[creator]) {
    return CREATOR_COLORS[creator];
  }

  let hash = 0;
  for (let i = 0; i < creator.length; i++) {
    hash = creator.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CHART_COLORS.length;
  return CHART_COLORS[index];
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
            style={{ backgroundColor: getModelColor(entry.model) }}
          />
          <span className="max-w-35 truncate sm:max-w-none">
            {formatModelName(entry.model)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PerformanceCharts({ reports }: PerformanceChartsProps) {
  const complexityFilter = useAtomValue(complexityFilterAtom);
  const sizeFilter = useAtomValue(sizeFilterAtom);
  const visionFilter = useAtomValue(visionFilterAtom);

  const data = computeModelMetricsPoints(
    reports,
    complexityFilter,
    sizeFilter,
    visionFilter
  );

  const hasAnyRuns = data.some((d) => d.nRuns > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-base sm:text-lg">Charts</h2>
      </div>

      {hasAnyRuns && <ModelLegend data={data} />}

      <SuccessRateBarCard data={data} showEmpty={!hasAnyRuns} />

      <Tabs defaultValue="steps">
        <TabsList>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="cost">Cost</TabsTrigger>
        </TabsList>

        <TabsContent value="steps">
          <StepsVsSuccessCard data={data} showEmpty={!hasAnyRuns} />
        </TabsContent>
        <TabsContent value="time">
          <TimeVsSuccessCard data={data} showEmpty={!hasAnyRuns} />
        </TabsContent>
        <TabsContent value="cost">
          <CostVsSuccessCard data={data} showEmpty={!hasAnyRuns} />
        </TabsContent>
      </Tabs>
    </div>
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
          <ChartContainer className="h-48 w-full sm:h-56" config={chartConfig}>
            <BarChart
              data={data}
              margin={{ left: 4, right: 4, top: 12, bottom: 24 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                angle={-30}
                dataKey="model"
                height={50}
                interval={0}
                textAnchor="end"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => formatModelName(v)}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent labelFormatter={formatModelName} />
                }
                cursor={false}
                formatter={(v) => `${Number(v).toFixed(1)}%`}
              />
              <Bar dataKey="successRatePct" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell fill={getModelColor(entry.model)} key={entry.model} />
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
  const filteredData = data.filter((d) => d.nSuccesses > 0);

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
          <ChartContainer className="h-48 w-full sm:h-56" config={chartConfig}>
            <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
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
                content={
                  <ChartTooltipContent
                    formatter={(v, name) => (
                      <span>
                        {name}: {name === "totalCost" ? "$" : ""}
                        {Number(v).toFixed(5)}
                        {name === "successRatePct" ? "%" : ""}
                      </span>
                    )}
                    indicator="dashed"
                    labelFormatter={formatModelName}
                  />
                }
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter data={filteredData} isAnimationActive={false}>
                {filteredData.map((entry) => (
                  <Cell fill={getModelColor(entry.model)} key={entry.model} />
                ))}
                <LabelList
                  className="hidden sm:block"
                  dataKey="model"
                  formatter={(v: string) => formatModelName(v)}
                  position="insideBottomLeft"
                  style={{
                    fontSize: 10,
                    fill: "var(--foreground)",
                    pointerEvents: "none",
                  }}
                />
              </Scatter>
            </ScatterChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function StepsVsSuccessCard(props: any) {
  return (
    <BaseScatterCard
      {...props}
      chartColor={CHART_COLORS[1]}
      title="Avg Steps vs Success Rate"
      xKey="avgSteps"
      xLabel="Avg Steps"
    />
  );
}

function TimeVsSuccessCard(props: any) {
  return (
    <BaseScatterCard
      {...props}
      chartColor={CHART_COLORS[2]}
      title="Avg Time vs Success Rate"
      xFormatter={(v) => `${Number(v).toFixed(0)}s`}
      xKey="avgTimeSec"
      xLabel="Avg Time (s)"
    />
  );
}

function CostVsSuccessCard(props: any) {
  return (
    <BaseScatterCard
      {...props}
      chartColor={CHART_COLORS[3]}
      title="Total cost vs Success Rate"
      xFormatter={(v) => `$${Number(v).toFixed(3)}`}
      xKey="totalCost"
      xLabel="Total Cost ($)"
    />
  );
}
