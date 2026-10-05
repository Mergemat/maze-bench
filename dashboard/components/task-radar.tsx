"use client";

import { Legend, Radar, RadarChart, Tooltip } from "@/components/dither-kit";

export function TaskRadar({
  data,
  subjectName,
  compareName,
}: {
  data: Array<{ task: string; subject: number; compare?: number }>;
  subjectName: string;
  compareName?: string;
}) {
  const config = {
    subject: { label: subjectName, color: "blue" as const },
    ...(compareName ? { compare: { label: compareName, color: "orange" as const } } : {}),
  };
  return (
    <RadarChart data={data} config={config} nameKey="task" bloom="low">
      {compareName ? <Legend align="center" /> : null}
      <Tooltip />
      <Radar dataKey="subject" variant="gradient" />
      {compareName ? <Radar dataKey="compare" variant="hatched" /> : null}
    </RadarChart>
  );
}
