"use client";

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

type PerformanceChartsProps = {
  reports: Map<string, BenchmarkReport>;
  complexityFilter: string | null;
  sizeFilter: string | null;
  visionFilter: string | null;
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "hsl(200, 70%, 50%)",
  "hsl(280, 70%, 50%)",
  "hsl(30, 70%, 50%)",
];

function getModelColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function _getPointSize(nRuns: number, maxRuns: number): number {
  const minSize = 60;
  const maxSize = 400;
  if (maxRuns === 0) {
    return minSize;
  }
  return minSize + (nRuns / maxRuns) * (maxSize - minSize);
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
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {data.map((entry, index) => (
        <div className="flex items-center gap-1.5" key={entry.model}>
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: getModelColor(index) }}
          />
          <span>{entry.model}</span>
        </div>
      ))}
    </div>
  );
}

export function PerformanceCharts({
  reports,
  complexityFilter,
  sizeFilter,
  visionFilter,
}: PerformanceChartsProps) {
  const data = computeModelMetricsPoints(
    reports,
    complexityFilter,
    sizeFilter,
    visionFilter
  );

  const hasAnyRuns = data.some((d) => d.nRuns > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-lg">Charts</h2>
      </div>

      {hasAnyRuns && <ModelLegend data={data} />}

      <SuccessRateBarCard data={data} showEmpty={!hasAnyRuns} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StepsVsSuccessCard data={data} showEmpty={!hasAnyRuns} />
        <TimeVsSuccessCard data={data} showEmpty={!hasAnyRuns} />
        <CostVsSuccessCard data={data} showEmpty={!hasAnyRuns} />
      </div>
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
        <CardTitle>Success Rate by Model</CardTitle>
      </CardHeader>
      <CardContent>
        {showEmpty ? (
          <EmptyState />
        ) : (
          <ChartContainer className="h-56 w-full" config={chartConfig}>
            <BarChart
              data={data}
              margin={{ left: 8, right: 8, top: 16, bottom: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="model"
                interval={0}
                tick={{ fontSize: 10 }}
                tickMargin={8}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => (
                      <div className="text-xs">
                        <div>{item.payload.model}</div>
                        <div>Success: {Number(value).toFixed(1)}%</div>
                        <div>
                          Runs: {item.payload.nRuns} ({item.payload.nSuccesses}{" "}
                          succeeded)
                        </div>
                      </div>
                    )}
                  />
                }
                cursor={false}
              />
              <Bar dataKey="successRatePct" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell fill={getModelColor(index)} key={entry.model} />
                ))}
                <LabelList
                  dataKey="nRuns"
                  formatter={(v: number) => `n=${v}`}
                  position="top"
                  style={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function StepsVsSuccessCard({
  data,
  showEmpty,
}: {
  data: ModelMetricsPoint[];
  showEmpty: boolean;
}) {
  const chartConfig = {
    avgSteps: { label: "Avg steps (successful runs)", color: CHART_COLORS[1] },
  } satisfies ChartConfig;

  const _maxRuns = Math.max(...data.map((d) => d.nRuns));
  const filteredData = data.filter((d) => d.nSuccesses > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avg Steps vs Success Rate</CardTitle>
        <p className="text-muted-foreground text-xs">
          Successful runs only. Dot size = sample size.
        </p>
      </CardHeader>
      <CardContent>
        {showEmpty || filteredData.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer className="h-56 w-full" config={chartConfig}>
            <ScatterChart margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid />
              <XAxis
                dataKey="avgSteps"
                domain={[0, "auto"]}
                label={{
                  value: "Avg Steps",
                  position: "bottom",
                  fontSize: 10,
                  offset: -5,
                }}
                name="Avg steps"
                tick={{ fontSize: 10 }}
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
                name="Success rate"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                type="number"
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="dashed" />}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter data={filteredData}>
                {filteredData.map((entry, _index) => (
                  <Cell
                    fill={getModelColor(
                      data.findIndex((d) => d.model === entry.model)
                    )}
                    key={entry.model}
                  />
                ))}
                <LabelList
                  dataKey="model"
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

function TimeVsSuccessCard({
  data,
  showEmpty,
}: {
  data: ModelMetricsPoint[];
  showEmpty: boolean;
}) {
  const chartConfig = {
    avgTimeSec: { label: "Avg time (s)", color: CHART_COLORS[2] },
  } satisfies ChartConfig;

  const _maxRuns = Math.max(...data.map((d) => d.nRuns));
  const filteredData = data.filter((d) => d.nSuccesses > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avg Time vs Success Rate</CardTitle>
        <p className="text-muted-foreground text-xs">
          Successful runs only. Dot size = sample size.
        </p>
      </CardHeader>
      <CardContent>
        {showEmpty || filteredData.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer className="h-56 w-full" config={chartConfig}>
            <ScatterChart margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid />
              <XAxis
                dataKey="avgTimeSec"
                domain={[0, "auto"]}
                label={{
                  value: "Avg Time (s)",
                  position: "bottom",
                  fontSize: 10,
                  offset: -5,
                }}
                name="Avg time (s)"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${Number(v).toFixed(0)}s`}
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
                name="Success rate"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                type="number"
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="dashed" />}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter data={filteredData}>
                {filteredData.map((entry, _index) => (
                  <Cell
                    fill={getModelColor(
                      data.findIndex((d) => d.model === entry.model)
                    )}
                    key={entry.model}
                  />
                ))}
                <LabelList
                  dataKey="model"
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

function CostVsSuccessCard({
  data,
  showEmpty,
}: {
  data: ModelMetricsPoint[];
  showEmpty: boolean;
}) {
  const chartConfig = {
    totalCost: { label: "Total Cost ($)", color: CHART_COLORS[3] },
  } satisfies ChartConfig;

  const _maxRuns = Math.max(...data.map((d) => d.nRuns));
  const filteredData = data.filter((d) => d.nSuccesses > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avg Cost vs Success Rate</CardTitle>
        <p className="text-muted-foreground text-xs">
          Successful runs only. Dot size = sample size.
        </p>
      </CardHeader>
      <CardContent>
        {showEmpty || filteredData.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer className="h-56 w-full" config={chartConfig}>
            <ScatterChart margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid />
              <XAxis
                dataKey="totalCost"
                domain={[0, "auto"]}
                label={{
                  value: "Total Cost ($)",
                  position: "bottom",
                  fontSize: 10,
                }}
                name="Total Cost"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `$${Number(v).toFixed(3)}`}
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
                name="Success rate"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                type="number"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-52"
                    formatter={(value, name, item) => (
                      <div className="flex flex-1 justify-between leading-none">
                        <div className="grid gap-1.5">
                          <span className="text-muted-foreground">{name}</span>
                        </div>
                        {value && (
                          <span className="font-medium font-mono text-foreground tabular-nums">
                            {item.dataKey === "totalCost"
                              ? `$${Number(value).toFixed(4)}`
                              : `${Number(value).toFixed(1)}%`}
                          </span>
                        )}
                      </div>
                    )}
                    indicator="dashed"
                  />
                }
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter data={filteredData}>
                {filteredData.map((entry, _index) => (
                  <Cell
                    fill={getModelColor(
                      data.findIndex((d) => d.model === entry.model)
                    )}
                    key={entry.model}
                  />
                ))}
                <LabelList
                  dataKey="model"
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

type CostVsSuccessTooltipProps = {
  active?: boolean;
  payload?: any[];
};

function _CostVsSuccessTooltip({ active, payload }: CostVsSuccessTooltipProps) {
  if (!(active && payload) || payload.length === 0) {
    return null;
  }

  const d = payload[0].payload;

  return (
    <div className="rounded-md border bg-background p-2 shadow-sm">
      <div className="font-medium text-xs">{d.model}</div>

      <div className="mt-1 space-y-0.5 text-muted-foreground text-xs">
        <div>
          Cost:{" "}
          <span className="font-medium text-foreground">
            ${d.totalCost.toFixed(4)}
          </span>
        </div>
        <div>
          Success rate:{" "}
          <span className="font-medium text-foreground">
            {d.successRatePct.toFixed(1)}%
          </span>
        </div>
        <div>
          Runs: <span className="font-medium text-foreground">{d.nRuns}</span>
        </div>
        <div>
          Successes:{" "}
          <span className="font-medium text-foreground">{d.nSuccesses}</span>
        </div>
      </div>
    </div>
  );
}
