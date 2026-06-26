"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export type DistributionRow = {
  metric: "name" | "image";
  bin: number;
  verdict: "SAME" | "DIFFERENT" | "UNKNOWN";
  cnt: number;
};

type CdfRow = { bin: string; SAME: number; DIFFERENT: number; UNKNOWN: number };

function buildCdf(rows: DistributionRow[], metric: "name" | "image"): CdfRow[] {
  // Aggregate raw counts per bin
  const map = new Map<number, { SAME: number; DIFFERENT: number; UNKNOWN: number }>();
  let total = 0;
  for (const r of rows) {
    if (r.metric !== metric) continue;
    if (!map.has(r.bin)) map.set(r.bin, { SAME: 0, DIFFERENT: 0, UNKNOWN: 0 });
    map.get(r.bin)![r.verdict] += r.cnt;
    total += r.cnt;
  }
  if (total === 0) return [];

  const sorted = Array.from(map.entries()).sort(([a], [b]) => a - b);

  // Build cumulative rows as % of total
  let cumSame = 0, cumDiff = 0, cumUnk = 0;
  return sorted.map(([bin, counts]) => {
    cumSame += counts.SAME;
    cumDiff += counts.DIFFERENT;
    cumUnk  += counts.UNKNOWN;
    return {
      bin: bin.toFixed(2),
      SAME:      parseFloat(((cumSame / total) * 100).toFixed(1)),
      DIFFERENT: parseFloat(((cumDiff / total) * 100).toFixed(1)),
      UNKNOWN:   parseFloat(((cumUnk  / total) * 100).toFixed(1)),
    };
  });
}

type TooltipPayload = { name: string; value: number; fill: string };

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload[payload.length - 1]?.value ?? 0;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-md px-4 py-3 text-xs space-y-1">
      <p className="font-semibold text-stone-600 mb-1">≤ {label}</p>
      {[...payload].reverse().map((p) => p.value > 0 && (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-stone-500">{p.name}:</span>
          <span className="font-bold text-stone-800">{p.value.toFixed(1)}%</span>
        </div>
      ))}
      <div className="border-t border-stone-100 pt-1 mt-1 flex justify-between">
        <span className="text-stone-400">cumulative total</span>
        <span className="font-bold text-stone-700">{total.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function CdfChart({
  data, title, refLine, refLabel,
}: {
  data: CdfRow[];
  title: string;
  refLine?: number;
  refLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide text-center">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -4, bottom: 0 }} barCategoryGap="10%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 9, fill: "#a8a29e" }}
            interval={1}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 9, fill: "#a8a29e" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
          <Bar dataKey="SAME"      stackId="a" fill="#22c55e" />
          <Bar dataKey="DIFFERENT" stackId="a" fill="#ef4444" />
          <Bar dataKey="UNKNOWN"   stackId="a" fill="#d6d3d1" radius={[2, 2, 0, 0]} />
          {refLine !== undefined && (
            <ReferenceLine
              x={refLine.toFixed(2)}
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="4 3"
              label={{ value: refLabel ?? `${refLine}`, position: "top", fontSize: 9, fill: "#7c3aed" }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SimilarityDistributionChart({
  data,
}: {
  data: DistributionRow[];
}) {
  const nameCdf  = buildCdf(data, "name");
  const imageCdf = buildCdf(data, "image");

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500 leading-relaxed">
        Cumulative distribution of all evaluated pairs by similarity score — each bar shows what % of
        total pairs fall at or below that score.{" "}
        <span className="text-green-600 font-semibold">Green = SAME</span>{" "}
        (ground truth confirms a match),{" "}
        <span className="text-red-500 font-semibold">Red = DIFFERENT</span>{" "}
        (confirmed mismatch),{" "}
        <span className="text-stone-400 font-semibold">Grey = no ground truth label</span>.
        The purple line marks the current threshold candidate. A good threshold is where
        the red (DIFFERENT) band flattens out before green (SAME) starts accumulating.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <CdfChart
          data={nameCdf}
          title="Name similarity (brand-stripped Jaccard)"
          refLine={0.50}
          refLabel="threshold 0.50"
        />
        <CdfChart
          data={imageCdf}
          title="Image similarity (DINOv2 × colour histogram)"
          refLine={0.80}
          refLabel="threshold 0.80"
        />
      </div>
    </div>
  );
}
